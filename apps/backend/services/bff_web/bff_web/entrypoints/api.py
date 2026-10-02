"""BFF Web: composición para gestión y back-office."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.integration import ServiceClient
from solventa_common.integration.base import call_upstream

from bff_web.config import settings

consenso = ServiceClient("validador-consenso", settings.consenso_url)
polizas = ServiceClient("polizas", settings.polizas_url)
router = APIRouter(prefix="/web", tags=["bff-web"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "BFF Web"}


@router.post("/cotizaciones")
def cotizar(solicitud: dict) -> dict:
    return call_upstream(consenso.post, "/consenso/cotizaciones", json=solicitud)


@router.get("/polizas/{poliza_id}")
def obtener_poliza(poliza_id: str) -> dict:
    return call_upstream(polizas.get, f"/polizas/{poliza_id}")


app = create_app(settings, routers=[router])
