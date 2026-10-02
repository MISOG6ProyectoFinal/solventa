"""Aplicación HTTP de Canales: monta un router por componente."""

from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from canales.config import settings
from canales.movil.api import router as movil_router
from canales.socios.api import router as socios_router
from canales.web.api import router as web_router

engine = optional_engine(settings.database_url)


app = create_app(
    settings,
    routers=[web_router, movil_router, socios_router],
    readiness_checks=readiness_checks(engine),
)
