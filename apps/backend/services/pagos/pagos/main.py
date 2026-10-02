"""Aplicación HTTP de Pagos: monta un router por componente."""

from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from pagos.cobros.api import router as cobros_router
from pagos.config import settings

engine = optional_engine(settings.database_url)


app = create_app(
    settings,
    routers=[cobros_router],
    readiness_checks=readiness_checks(engine),
)
