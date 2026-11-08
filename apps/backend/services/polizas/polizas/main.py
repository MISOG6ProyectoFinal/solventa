"""Aplicación HTTP de Pólizas: monta un router por componente."""

import logging
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from polizas.ciclo_vida.api import router as ciclo_vida_router
from polizas.ciclo_vida.api import use_cases
from polizas.config import settings
from polizas.reaseguro.api import router as reaseguro_router
from polizas.suscripcion.api import router as suscripcion_router

logger = logging.getLogger(__name__)
engine = optional_engine(settings.database_url)


@asynccontextmanager
async def _lifespan(_app: object) -> AsyncIterator[None]:
    """Reintenta eventos de renovación que quedaron pendientes después del commit."""
    stop = threading.Event()

    def _publicar_pendientes() -> None:
        while not stop.is_set():
            try:
                caso = use_cases.get("apply")
                if caso is not None:
                    caso.publish_pending()
            except Exception:
                logger.exception("Reintento de eventos de renovación")
            if stop.wait(5):
                return

    thread = threading.Thread(target=_publicar_pendientes, name="polizas-outbox", daemon=True)
    thread.start()
    try:
        yield
    finally:
        stop.set()


app = create_app(
    settings,
    routers=[suscripcion_router, ciclo_vida_router, reaseguro_router],
    readiness_checks=readiness_checks(engine),
    lifespan=_lifespan,
)
