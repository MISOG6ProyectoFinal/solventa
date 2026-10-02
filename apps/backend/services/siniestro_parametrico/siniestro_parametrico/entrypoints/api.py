"""Entrada HTTP de Siniestro Paramétrico: recibe el hecho externo y lo publica en el bus."""

from fastapi import APIRouter, status
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from siniestro_parametrico.adapters.bus import build_publisher
from siniestro_parametrico.config import settings
from siniestro_parametrico.domain.models import EventoParametrico
from siniestro_parametrico.domain.use_cases import RegistrarEventoUseCase

engine = optional_engine(settings.database_url)
registrar = RegistrarEventoUseCase(build_publisher())
router = APIRouter(prefix="/parametricos", tags=["siniestro-parametrico"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Siniestro Paramétrico"}


@router.post("/eventos", status_code=status.HTTP_202_ACCEPTED)
def registrar_evento(evento: EventoParametrico) -> dict:
    event = registrar.execute(evento)
    return {"event_id": event.event_id, "idempotency_key": event.idempotency_key}


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
