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


@router.post("/siniestros", status_code=201)
def reportar_siniestro(aviso: dict) -> dict:
    return call_upstream(siniestros.post, "/siniestros/avisos", json=aviso)


@router.post("/siniestros/{aviso_id}/evidencias/cargas", status_code=201)
def solicitar_carga(aviso_id: str, carga: dict) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json=carga,
    )


@router.post("/siniestros/{aviso_id}/evidencias/{evidencia_id}/confirmar")
def confirmar_carga(aviso_id: str, evidencia_id: str) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/evidencias/{evidencia_id}/confirmar",
    )


@router.get("/siniestros/{aviso_id}/evidencias")
def listar_evidencias(aviso_id: str):
    return call_upstream(siniestros.get, f"/siniestros/avisos/{aviso_id}/evidencias")
