"""Entrada HTTP de Reaseguro y Cesión."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from reaseguro.config import settings

engine = optional_engine(settings.database_url)
router = APIRouter(prefix="/reaseguro", tags=["reaseguro"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Reaseguro y Cesión"}


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
