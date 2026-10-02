"""Aplicación HTTP de Auditoría: monta un router por componente."""

from contextlib import asynccontextmanager

from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks
from solventa_common.events import Event, start_background_consumer

from auditoria.analitica import handlers as analitica_handlers
from auditoria.analitica.api import router as analitica_router
from auditoria.config import settings
from auditoria.linaje import handlers as linaje_handlers
from auditoria.linaje.api import router as linaje_router
from auditoria.notificaciones import handlers as notificaciones_handlers
from auditoria.notificaciones.api import router as notificaciones_router

engine = optional_engine(settings.database_url)

HANDLERS = [linaje_handlers.handle, analitica_handlers.handle, notificaciones_handlers.handle]


def dispatch(event: Event) -> None:
    for handle in HANDLERS:
        handle(event)


@asynccontextmanager
async def lifespan(_app):
    consumer = start_background_consumer(
        settings.events_queue_url, dispatch, settings.aws_region, settings.aws_endpoint_url
    )
    yield
    if consumer:
        consumer.stop()


app = create_app(
    settings,
    routers=[linaje_router, analitica_router, notificaciones_router],
    readiness_checks=readiness_checks(engine),
    lifespan=lifespan,
)
