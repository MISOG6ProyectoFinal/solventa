"""Monitor de Salud y Retiro: heartbeat cada 500 ms a /health/ready de cada servicio.

El retiro efectivo del pod lo hace Kubernetes con la readinessProbe (periodo 1 s,
el mínimo que admite). Este monitor da la vista agregada por servicio y deja la
traza que el balanceador y las alarmas consumen.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from dataclasses import asdict
from time import perf_counter

import httpx
from fastapi import APIRouter
from solventa_common.app import create_app

from health_monitor.config import settings
from health_monitor.domain.estado import EstadoServicio

logger = logging.getLogger(__name__)
estados = {t: EstadoServicio(t) for t in settings.targets}
router = APIRouter(prefix="/monitor", tags=["health-monitor"])


async def latido(client: httpx.AsyncClient, estado: EstadoServicio) -> None:
    inicio = perf_counter()
    try:
        response = await client.get(f"http://{estado.servicio}/health/ready")
        ok = response.status_code == 200
    except httpx.HTTPError:
        ok = False
    era_sano = estado.sano
    estado.registrar(ok, round((perf_counter() - inicio) * 1000, 1), settings.fallas_para_retiro)
    if era_sano and not estado.sano:
        logger.warning("Servicio %s retirado tras %s fallas", estado.servicio, estado.fallas_consecutivas)


async def bucle_latidos() -> None:
    async with httpx.AsyncClient(timeout=settings.heartbeat_timeout_s) as client:
        while True:
            await asyncio.gather(*(latido(client, e) for e in estados.values()))
            await asyncio.sleep(settings.heartbeat_interval_s)


@asynccontextmanager
async def lifespan(_app):
    task = asyncio.create_task(bucle_latidos())
    yield
    task.cancel()


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Monitor de Salud y Retiro", "targets": settings.targets}


@router.get("/estado")
def estado() -> dict:
    return {"sanos": all(e.sano for e in estados.values()), "servicios": [asdict(e) for e in estados.values()]}


app = create_app(settings, routers=[router], lifespan=lifespan)
