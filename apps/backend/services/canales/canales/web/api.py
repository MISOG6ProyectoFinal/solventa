from fastapi import APIRouter, status
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


@router.post("/cotizaciones")
def cotizar(solicitud: dict) -> dict:
    return call_upstream(
        cotizacion.post,
        "/consenso/cotizaciones",
        json=solicitud,
        headers={"X-Canal": "web"},
    )


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
