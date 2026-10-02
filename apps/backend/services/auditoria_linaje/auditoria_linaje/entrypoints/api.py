"""Entrada HTTP de Auditoría y Linaje del Dato."""

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks
from solventa_common.events import Event, start_background_consumer

from auditoria_linaje.config import settings

engine = optional_engine(settings.database_url)
router = APIRouter(prefix="/auditoria", tags=["auditoria-linaje"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Auditoría y Linaje del Dato"}


logger = logging.getLogger(__name__)


def handle_event(event: Event) -> None:
    # TODO: lógica de Auditoría y Linaje del Dato sobre cada evento de integración.
    logger.info("evento %s %s", event.event_type, event.event_id)


@asynccontextmanager
async def lifespan(_app):
    consumer = start_background_consumer(
        settings.events_queue_url, handle_event, settings.aws_region, settings.aws_endpoint_url
    )
    yield
    if consumer:
        consumer.stop()


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine), lifespan=lifespan)
