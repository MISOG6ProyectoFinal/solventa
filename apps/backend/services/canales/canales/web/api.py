from fastapi import APIRouter, status
from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion, polizas

router = APIRouter(prefix="/web", tags=["BFF Web"])


@router.get("/")
def info() -> dict:
    return {"component": "BFF Web"}


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
