"""Entrada HTTP del Validador de Consenso."""

from fastapi import APIRouter, HTTPException
from solventa_common.app import create_app

from validador_consenso.adapters.replicas import cotizar_en_replicas, resolver_replicas
from validador_consenso.config import settings
from validador_consenso.domain.consensus import SinConsenso, votar

router = APIRouter(prefix="/consenso", tags=["validador-consenso"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Validador de Consenso", "quorum": settings.quorum}


@router.post("/cotizaciones")
async def cotizar_con_consenso(solicitud: dict) -> dict:
    try:
        ips = resolver_replicas(settings.cotizacion_replicas_host, settings.cotizacion_port)
    except OSError as exc:
        raise HTTPException(status_code=503, detail="Cotización no disponible") from exc
    ips = ips[: settings.replicas_esperadas]
    respuestas = await cotizar_en_replicas(ips, settings.cotizacion_port, solicitud, settings.timeout_s)
    try:
        prima = votar([r["prima"] for r in respuestas], settings.quorum)
    except SinConsenso as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    elegida = next(r for r in respuestas if r["prima"] == prima)
    return {**elegida, "votos": sum(r["prima"] == prima for r in respuestas), "replicas": len(ips)}


app = create_app(settings, routers=[router])
