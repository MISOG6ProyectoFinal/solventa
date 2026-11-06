import httpx
from fastapi import APIRouter, HTTPException, status
from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion, identidad
from canales.web.policies import policy_detail, recent_policies

router = APIRouter(prefix="/web", tags=["BFF Web"])


@router.get("/")
def info() -> dict:
    return {"component": "BFF Web"}


RAMOS_COTIZABLES_WEB = {
    "ramo-viaje",
    "ramo-microseguro-vida",
    "ramo-vida-hipotecario",
    "ramo-parametrico",
}

RAMOS_CON_CONSENTIMIENTO = {"vida-hipotecario", "ramo-vida-hipotecario"}
OPEN_FINANCE_SCOPE = "Open Finance"

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


@router.get("/ramos")
def listar_ramos() -> list:
    ramos = call_upstream(cotizacion.get, "/catalogo/ramos")
    return [r for r in ramos if r.get("id") in RAMOS_COTIZABLES_WEB]


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


def _validar_consentimiento_si_aplica(solicitud: dict) -> dict | None:
    producto_id = solicitud.get("producto_id", "")
    if producto_id not in RAMOS_CON_CONSENTIMIENTO:
        return None
    consentimiento_id = solicitud.get("consentimiento_id")
    if not consentimiento_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El ramo vida hipotecario requiere consentimiento digital previamente validado",
        )
    consentimiento = call_upstream(identidad.get, f"/identidad/{consentimiento_id}")
    if not consentimiento or str(consentimiento.get("estado", "")).strip().upper() != "OTORGADO":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El consentimiento digital no se encuentra otorgado o no es válido",
        )
    return consentimiento


def _open_finance_consent(consentimiento: dict | None) -> dict | None:
    """El cliente que autorizó Open Finance en el consentimiento digital lo autoriza también para la cotización."""
    if not consentimiento or OPEN_FINANCE_SCOPE not in consentimiento.get("alcance_lista", []):
        return None
    return {
        "referencia_cliente": consentimiento["cliente_id"],
        "consentimiento_id": consentimiento["consentimiento_id"],
    }


@router.post("/cotizaciones")
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


@router.get("/cotizaciones/{cotizacion_id}")
def obtener_cotizacion(cotizacion_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/consenso/cotizaciones/{cotizacion_id}")


@router.post("/socios", status_code=status.HTTP_201_CREATED)
def dar_de_alta_socio(alta: dict) -> dict:
    return call_upstream(cotizacion.post, "/gobierno-socios/socios", json=alta)


@router.get("/socios")
def listar_socios() -> list:
    return call_upstream(cotizacion.get, "/gobierno-socios/socios")


@router.get("/socios/{socio_id}")
def obtener_socio(socio_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/gobierno-socios/socios/{socio_id}")


@router.get("/socios/{socio_id}/configuracion")
def consultar_configuracion_socio(socio_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/gobierno-socios/socios/{socio_id}/configuracion")


@router.put("/socios/{socio_id}/configuracion")
def actualizar_configuracion_socio(socio_id: str, configuracion: dict) -> dict:
    return call_upstream(cotizacion.put, f"/gobierno-socios/socios/{socio_id}/configuracion", json=configuracion)


@router.get("/polizas")
def listar_polizas() -> list[dict]:
    """Últimas pólizas de todos los canales con el asegurado, el socio y el ramo."""
    return recent_policies()


@router.get("/polizas/{poliza_id}")
def obtener_poliza(poliza_id: str) -> dict:
    """La póliza con el asegurado, el socio, el ramo, sus cobros y sus siniestros."""
    return policy_detail(poliza_id)


# --- HU002: Proxy de Consentimiento Digital hacia identidad ---


@router.post("/consentimientos/solicitar", status_code=status.HTTP_201_CREATED)
def solicitar_consentimiento(solicitud: dict) -> dict:
    return call_upstream(identidad.post, "/identidad/solicitar", json=solicitud)


@router.post("/consentimientos/validar")
def validar_consentimiento(solicitud: dict) -> dict:
    return call_upstream(identidad.post, "/identidad/validar", json=solicitud)


@router.get("/consentimientos/{consentimiento_id}")
def consultar_consentimiento(consentimiento_id: str) -> dict:
    return call_upstream(identidad.get, f"/identidad/{consentimiento_id}")
