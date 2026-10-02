"""Aplicación HTTP de Cotización: monta un router por componente."""

from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from cotizacion.catalogo.api import router as catalogo_router
from cotizacion.config import settings
from cotizacion.consenso.api import router as consenso_router
from cotizacion.gobierno_socios.api import router as gobierno_socios_router
from cotizacion.rating.api import router as rating_router

engine = optional_engine(settings.database_url)


app = create_app(
    settings,
    routers=[rating_router, consenso_router, catalogo_router, gobierno_socios_router],
    readiness_checks=readiness_checks(engine),
)
