"""BFF Móvil: cargas útiles reducidas para la app del asegurado."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.integration import ServiceClient
from solventa_common.integration.base import call_upstream

from bff_movil.config import settings

consenso = ServiceClient("validador-consenso", settings.consenso_url)
siniestros = ServiceClient("siniestros", settings.siniestros_url)
router = APIRouter(prefix="/movil", tags=["bff-movil"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "BFF Móvil"}


@router.post("/cotizaciones")
def cotizar(solicitud: dict) -> dict:
    cotizacion = call_upstream(consenso.post, "/consenso/cotizaciones", json=solicitud)
    return {"prima": cotizacion["prima"], "version_reglas": cotizacion["version_reglas"]}


@router.post("/siniestros")
def reportar_siniestro(aviso: dict) -> dict:
    return call_upstream(siniestros.post, "/siniestros/", json=aviso)


app = create_app(settings, routers=[router])
