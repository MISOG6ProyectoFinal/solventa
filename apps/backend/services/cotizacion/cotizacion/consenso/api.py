"""Validador de Consenso: la réplica que recibe la solicitud la reparte entre las
tres réplicas (incluida ella misma) y responde con la prima mayoritaria."""

from fastapi import APIRouter, HTTPException

from cotizacion.config import settings
from cotizacion.consenso.adapters.replicas import cotizar_en_replicas, resolver_replicas
from cotizacion.consenso.domain.consensus import SinConsenso, votar

router = APIRouter(prefix="/consenso", tags=["Validador de Consenso"])


@router.get("/")
def info() -> dict:
    return {"component": "Validador de Consenso", "quorum": settings.quorum}


@router.post("/cotizaciones")
async def cotizar_con_consenso(solicitud: dict) -> dict:
    try:
        ips = resolver_replicas(settings.cotizacion_replicas_host, settings.cotizacion_port)
    except OSError as exc:
        raise HTTPException(status_code=503, detail="Réplicas de cotización no disponibles") from exc
    ips = ips[: settings.replicas_esperadas]
    respuestas = await cotizar_en_replicas(ips, settings.cotizacion_port, solicitud, settings.consenso_timeout_s)
    try:
        prima = votar([r["prima"] for r in respuestas], settings.quorum)
    except SinConsenso as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    elegida = next(r for r in respuestas if r["prima"] == prima)
    return {**elegida, "votos": sum(r["prima"] == prima for r in respuestas), "replicas": len(ips)}
