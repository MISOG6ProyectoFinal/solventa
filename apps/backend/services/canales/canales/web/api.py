from fastapi import APIRouter
from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion, polizas

router = APIRouter(prefix="/web", tags=["BFF Web"])


@router.get("/")
def info() -> dict:
    return {"component": "BFF Web"}


@router.post("/cotizaciones")
def cotizar(solicitud: dict) -> dict:
    return call_upstream(cotizacion.post, "/consenso/cotizaciones", json=solicitud)


@router.get("/polizas/{poliza_id}")
def obtener_poliza(poliza_id: str) -> dict:
    return call_upstream(polizas.get, f"/polizas/{poliza_id}")
