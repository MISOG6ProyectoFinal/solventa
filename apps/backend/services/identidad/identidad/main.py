"""Aplicación HTTP de Identidad: monta un router por componente."""

from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from identidad.config import settings
from identidad.container import container
from identidad.kyc.api import router as kyc_router
from identidad.perfilamiento.api import router as perfilamiento_router

engine = optional_engine(settings.database_url)
if engine is not None:
    container.use_postgres(engine)


app = create_app(
    settings,
    routers=[kyc_router, perfilamiento_router],
    readiness_checks=readiness_checks(engine),
)
