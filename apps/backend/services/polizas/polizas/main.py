"""Aplicación HTTP de Pólizas: monta un router por componente."""

from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from polizas.ciclo_vida.api import router as ciclo_vida_router
from polizas.config import settings
from polizas.reaseguro.api import router as reaseguro_router
from polizas.suscripcion.api import router as suscripcion_router

engine = optional_engine(settings.database_url)


app = create_app(
    settings,
    routers=[suscripcion_router, ciclo_vida_router, reaseguro_router],
    readiness_checks=readiness_checks(engine),
)
