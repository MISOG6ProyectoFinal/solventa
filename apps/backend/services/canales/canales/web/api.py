from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from solventa_common.integration.base import call_upstream
from solventa_common.operator_session import ADMIN, ADVISOR

from canales.clients import cotizacion, identidad, polizas
from canales.web.auth import Operator, require_operator, require_roles
from canales.web.policies import policy_detail, recent_policies, register_endorsement

CONSENT_GRANTED = "OTORGADO"

router = APIRouter(prefix="/web", tags=["BFF Web"])

require_writer = require_roles(ADMIN, ADVISOR)
require_admin = require_roles(ADMIN)

readers = APIRouter(dependencies=[Depends(require_operator)])
writers = APIRouter(dependencies=[Depends(require_writer)])
admins = APIRouter(dependencies=[Depends(require_admin)])


class OperatorLogin(BaseModel):
    correo: str
    contrasena: str


@router.get("/")
def info() -> dict:
    return {"component": "BFF Web"}


@router.post("/sesiones")
def start_session(credentials: OperatorLogin) -> dict:
    return call_upstream(identidad.post, "/identidad/operadores/sesiones", json=credentials.model_dump())


@readers.get("/sesion")
def current_session(operator: Operator) -> dict:
    return {
        "id": operator.operator_id,
        "correo": operator.email,
        "nombre": operator.name,
        "roles": list(operator.roles),
    }


CUSTOMER_FIELDS = frozenset(
    {
        "cliente_id",
        "tipo_documento",
        "tipoDocumento",
        "numero_documento",
        "numeroDocumento",
        "nombre",
        "apellido",
        "email",
        "telefono",
    }
)


@readers.get("/ramos")
def listar_ramos() -> list:
    return call_upstream(cotizacion.get, "/catalogo/canales/web/ramos")


@readers.get("/productos/{producto_id}/contrato")
def contrato_producto(producto_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/catalogo/productos/{quote(producto_id, safe='')}/contrato")


@readers.get("/tipos-documento")
def listar_tipos_documento() -> list:
    return call_upstream(identidad.get, "/identidad/tipos-documento")


def _extraer_identificacion(solicitud: dict) -> tuple[str, str]:
    tipo_doc = str(solicitud.get("tipo_documento") or solicitud.get("tipoDocumento") or "").strip()
    num_doc = str(solicitud.get("numero_documento") or solicitud.get("numeroDocumento") or "").strip()
    return tipo_doc, num_doc


def _buscar_cliente_por_documento(tipo_doc: str, num_doc: str) -> str | None:
    try:
        cliente = identidad.get(f"/identidad/clientes/por-documento/{tipo_doc}/{num_doc}")
        if cliente and cliente.get("id"):
            return cliente["id"]
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != status.HTTP_404_NOT_FOUND:
            raise
    return None


def _asegurar_nuevo_cliente(solicitud: dict, tipo_doc: str, num_doc: str) -> str | None:
    nombre = str(solicitud.get("nombre") or "").strip() or "Cliente"
    apellido = str(solicitud.get("apellido") or "").strip()
    email = str(solicitud.get("email") or "").strip()
    telefono = str(solicitud.get("telefono") or "").strip()
    fecha_nac = solicitud.get("fecha_nacimiento") or solicitud.get("fechaNacimiento")
    fecha_nac_str = str(fecha_nac) if fecha_nac else None

    nuevo = call_upstream(
        identidad.post,
        "/identidad/clientes/asegurar",
        json={
            "tipo_documento": tipo_doc,
            "numero_documento": num_doc,
            "nombre": nombre,
            "apellido": apellido,
            "email": email,
            "telefono": telefono,
            "fecha_nacimiento": fecha_nac_str,
        },
    )
    if not nuevo:
        return None
    return nuevo.get("id")


def _resolver_cliente_id(solicitud: dict) -> str | None:
    tipo_doc, num_doc = _extraer_identificacion(solicitud)
    if not (tipo_doc and num_doc):
        return solicitud.get("cliente_id")

    # 1. Validar si el usuario existe por tipo de documento y número de documento
    cliente_id = _buscar_cliente_por_documento(tipo_doc, num_doc)
    if cliente_id:
        return cliente_id

    # 2. Si no existe, se debe crear el nuevo cliente
    return _asegurar_nuevo_cliente(solicitud, tipo_doc, num_doc)


def _requires_consent(product_id: object) -> bool:
    if not isinstance(product_id, str) or not product_id.strip():
        return False
    try:
        product = call_upstream(cotizacion.get, f"/catalogo/productos/{quote(product_id.strip(), safe='')}")
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            return False
        raise
    return bool(product.get("requiere_consentimiento"))


def _validar_consentimiento_si_aplica(solicitud: dict) -> dict | None:
    if not _requires_consent(solicitud.get("producto_id")):
        return None
    consentimiento_id = solicitud.get("consentimiento_id")
    if not consentimiento_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El producto requiere consentimiento digital previamente validado",
        )
    consentimiento = call_upstream(identidad.get, f"/identidad/{consentimiento_id}")
    if not consentimiento or str(consentimiento.get("estado", "")).strip().upper() != CONSENT_GRANTED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El consentimiento digital no se encuentra otorgado o no es válido",
        )
    return consentimiento


def _open_finance_consent(consentimiento: dict | None) -> dict | None:
    """El cliente que autorizó Open Finance en el consentimiento digital lo autoriza también para la cotización."""
    if not consentimiento or not consentimiento.get("open_finance"):
        return None
    return {
        "referencia_cliente": consentimiento["cliente_id"],
        "consentimiento_id": consentimiento["consentimiento_id"],
    }


@writers.post("/cotizaciones")
def cotizar(solicitud: dict) -> dict:
    """El portal resuelve el cliente y el consentimiento; la cotización es la de todos los canales."""
    open_finance = _open_finance_consent(_validar_consentimiento_si_aplica(solicitud))

    headers = {"X-Canal": "web"}
    cliente_id = _resolver_cliente_id(solicitud)
    if cliente_id:
        headers["X-Cliente-Id"] = cliente_id

    return call_upstream(
        cotizacion.post,
        "/consenso/cotizaciones",
        json={key: value for key, value in solicitud.items() if key not in CUSTOMER_FIELDS}
        | ({"consentimiento_open_finance": open_finance} if open_finance else {}),
        headers=headers,
    )


@readers.get("/cotizaciones/{cotizacion_id}")
def obtener_cotizacion(cotizacion_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/consenso/cotizaciones/{cotizacion_id}")


@admins.post("/socios", status_code=status.HTTP_201_CREATED)
def dar_de_alta_socio(alta: dict, operator: Operator) -> dict:
    return call_upstream(cotizacion.post, "/gobierno-socios/socios", json={**alta, "autorizado_por": operator.name})


@readers.get("/socios")
def listar_socios() -> list:
    return call_upstream(cotizacion.get, "/gobierno-socios/socios")


@readers.get("/socios/tipos")
def listar_tipos_socio() -> list:
    return call_upstream(cotizacion.get, "/gobierno-socios/tipos")


@readers.get("/socios/alcances")
def listar_alcances() -> list:
    return call_upstream(cotizacion.get, "/gobierno-socios/alcances")


@readers.get("/socios/{socio_id}")
def obtener_socio(socio_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/gobierno-socios/socios/{socio_id}")


@readers.get("/socios/{socio_id}/configuracion")
def consultar_configuracion_socio(socio_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/gobierno-socios/socios/{socio_id}/configuracion")


@admins.put("/socios/{socio_id}/configuracion")
def actualizar_configuracion_socio(socio_id: str, configuracion: dict, operator: Operator) -> dict:
    return call_upstream(
        cotizacion.put,
        f"/gobierno-socios/socios/{socio_id}/configuracion",
        json={**configuracion, "actualizado_por": operator.name},
    )


@readers.get("/socios/{socio_id}/consumo")
def partner_quota_usage(socio_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/gobierno-socios/socios/{quote(socio_id, safe='')}/consumo")


@admins.put("/socios/{socio_id}/cuota")
def update_partner_quota(socio_id: str, body: dict) -> dict:
    return call_upstream(
        cotizacion.put,
        f"/gobierno-socios/socios/{quote(socio_id, safe='')}/cuota",
        json={"cuota_consumo": body.get("cuota_consumo")},
    )


@readers.get("/polizas/estados")
def listar_estados_poliza() -> list:
    return call_upstream(polizas.get, "/polizas/catalogos/estados")


@readers.get("/polizas/causas-cancelacion")
def listar_causas_cancelacion() -> list:
    return call_upstream(polizas.get, "/polizas/catalogos/causas-cancelacion")


@readers.get("/polizas/tipos-endoso")
def listar_tipos_endoso(ramo_id: str | None = None) -> list:
    params = {"ramo_id": ramo_id} if ramo_id else {}
    return call_upstream(polizas.get, "/polizas/catalogos/tipos-endoso", params=params)


@readers.get("/polizas")
def listar_polizas() -> list[dict]:
    """Últimas pólizas de todos los canales con el asegurado, el socio y el ramo."""
    return recent_policies()


@readers.get("/polizas/{poliza_id}")
def obtener_poliza(poliza_id: str) -> dict:
    """La póliza con el asegurado, el socio, el ramo, sus cobros y sus siniestros."""
    return policy_detail(poliza_id)


@writers.post("/polizas/{poliza_id}/endosos", status_code=status.HTTP_201_CREATED)
def registrar_endoso(poliza_id: str, body: dict, operator: Operator) -> dict:
    """Endoso de datos del asegurado. El usuario sale del token, no del cuerpo."""
    return register_endorsement(poliza_id, body, operator.operator_id)


@writers.post("/polizas/{poliza_id}/cancelacion/calculo")
def calcular_cancelacion(poliza_id: str, body: dict) -> dict:
    """Recálculo de la devolución: Pólizas consulta a Cotización y no cambia nada."""
    path = f"/polizas/{quote(poliza_id, safe='')}/cancelacion/calculo"
    return call_upstream(polizas.post, path, json={"causa": body.get("causa")})


@writers.post("/polizas/{poliza_id}/cancelacion")
def cancelar_poliza(poliza_id: str, body: dict, operator: Operator) -> dict:
    """Cancelación definitiva. El usuario sale del token, no del cuerpo."""
    path = f"/polizas/{quote(poliza_id, safe='')}/cancelacion"
    return call_upstream(polizas.post, path, json={"causa": body.get("causa"), "usuario_id": operator.operator_id})


# --- HU002: Proxy de Consentimiento Digital hacia identidad ---


@writers.post("/consentimientos/solicitar", status_code=status.HTTP_201_CREATED)
def solicitar_consentimiento(solicitud: dict, operator: Operator) -> dict:
    return call_upstream(identidad.post, "/identidad/solicitar", json={**solicitud, "asesor": operator.name})


@writers.post("/consentimientos/validar")
def validar_consentimiento(solicitud: dict) -> dict:
    return call_upstream(identidad.post, "/identidad/validar", json=solicitud)


@readers.get("/consentimientos/{consentimiento_id}")
def consultar_consentimiento(consentimiento_id: str) -> dict:
    return call_upstream(identidad.get, f"/identidad/{consentimiento_id}")


@admins.get("/operadores")
def list_operators() -> list:
    return call_upstream(identidad.get, "/identidad/operadores")


@admins.post("/operadores", status_code=status.HTTP_201_CREATED)
def create_operator(payload: dict) -> dict:
    return call_upstream(identidad.post, "/identidad/operadores", json=payload)


@admins.patch("/operadores/{operator_id}")
def update_operator(operator_id: str, changes: dict) -> dict:
    return call_upstream(identidad.patch, f"/identidad/operadores/{quote(operator_id, safe='')}", json=changes)


router.include_router(readers)
router.include_router(writers)
router.include_router(admins)
