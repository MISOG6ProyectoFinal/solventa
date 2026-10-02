"""Aplicación HTTP de Siniestros: monta un router por componente."""

from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from siniestros.avisos.api import router as avisos_router
from siniestros.config import settings
from siniestros.parametrico.api import router as parametrico_router

engine = optional_engine(settings.database_url)


app = create_app(
    settings,
    routers=[avisos_router, parametrico_router],
    readiness_checks=readiness_checks(engine),
)
