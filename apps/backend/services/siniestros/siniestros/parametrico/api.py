"""Recibe el hecho externo y lo publica en el bus. La liquidación ocurre en el worker."""

from fastapi import APIRouter, status

from siniestros.parametrico.adapters.bus import build_publisher
from siniestros.parametrico.domain.models import EventoParametrico
from siniestros.parametrico.domain.use_cases import RegistrarEventoUseCase

registrar = RegistrarEventoUseCase(build_publisher())
router = APIRouter(prefix="/parametricos", tags=["Siniestro Paramétrico"])


@router.get("/")
def info() -> dict:
    return {"component": "Siniestro Paramétrico"}


@router.post("/eventos", status_code=status.HTTP_202_ACCEPTED)
def registrar_evento(evento: EventoParametrico) -> dict:
    event = registrar.execute(evento)
    return {"event_id": event.event_id, "idempotency_key": event.idempotency_key}
