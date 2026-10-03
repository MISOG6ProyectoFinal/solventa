from fastapi import APIRouter
from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion, siniestros

router = APIRouter(prefix="/movil", tags=["BFF Móvil"])


@router.get("/")
def info() -> dict:
    return {"component": "BFF Móvil"}


@router.post("/cotizaciones")
def cotizar(solicitud: dict) -> dict:
    resultado = call_upstream(cotizacion.post, "/consenso/cotizaciones", json=solicitud)
    return {"prima": resultado["prima"], "version_reglas": resultado["version_reglas"]}


@router.post("/siniestros")
def reportar_siniestro(aviso: dict) -> dict:
    return call_upstream(siniestros.post, "/siniestros/", json=aviso)
