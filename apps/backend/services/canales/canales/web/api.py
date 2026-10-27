import httpx
from fastapi import APIRouter, HTTPException, status
from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion, identidad, polizas

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


@router.get("/ramos")
def listar_ramos() -> list:
    ramos = call_upstream(cotizacion.get, "/catalogo/ramos")
    return [r for r in ramos if r.get("id") in RAMOS_COTIZABLES_WEB]


def _resolver_cliente_id(solicitud: dict) -> str | None:
    tipo_doc = (solicitud.get("tipo_documento") or solicitud.get("tipoDocumento") or "").strip()
    num_doc = (solicitud.get("numero_documento") or solicitud.get("numeroDocumento") or "").strip()
    if not tipo_doc or not num_doc:
        return solicitud.get("cliente_id")

    # 1. Validar si el usuario existe por tipo de documento y número de documento
    try:
        cliente = identidad.get(f"/identidad/clientes/por-documento/{tipo_doc}/{num_doc}")
        if cliente and cliente.get("id"):
            return cliente["id"]
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != status.HTTP_404_NOT_FOUND:
            raise

    # 2. Si no existe, se debe crear el nuevo cliente
    nombre = (solicitud.get("nombre") or "").strip()
    apellido = (solicitud.get("apellido") or "").strip()
    email = (solicitud.get("email") or "").strip()
    telefono = (solicitud.get("telefono") or "").strip()
    fecha_nac = solicitud.get("fecha_nacimiento") or solicitud.get("fechaNacimiento")

    nuevo = call_upstream(
        identidad.post,
        "/identidad/clientes/asegurar",
        json={
            "tipo_documento": tipo_doc,
            "numero_documento": num_doc,
            "nombre": nombre or "Cliente",
            "apellido": apellido,
            "email": email,
            "telefono": telefono,
            "fecha_nacimiento": str(fecha_nac) if fecha_nac else None,
        },
    )
    return nuevo.get("id") if nuevo else None


@router.post("/cotizaciones")
def cotizar(solicitud: dict) -> dict:
    producto_id = solicitud.get("producto_id", "")
    if producto_id in ("vida-hipotecario", "ramo-vida-hipotecario"):
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

    cliente_id = _resolver_cliente_id(solicitud)
    if cliente_id:
        solicitud["cliente_id"] = cliente_id

    return call_upstream(
        cotizacion.post,
        "/consenso/cotizaciones",
        json=solicitud,
        headers={"X-Canal": "web"},
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


@router.get("/polizas/{poliza_id}")
def obtener_poliza(poliza_id: str) -> dict:
    return call_upstream(polizas.get, f"/polizas/{poliza_id}")


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
