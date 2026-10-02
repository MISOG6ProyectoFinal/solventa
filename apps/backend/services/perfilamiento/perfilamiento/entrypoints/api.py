"""Entrada HTTP de Perfilamiento y Personalización."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from perfilamiento.config import settings

engine = optional_engine(settings.database_url)
router = APIRouter(prefix="/perfiles", tags=["perfilamiento"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Perfilamiento y Personalización"}


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
