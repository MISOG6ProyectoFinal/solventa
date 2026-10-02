"""Entrada HTTP de Socios y Gobierno de API."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from socios_gobierno_api.config import settings

engine = optional_engine(settings.database_url)
router = APIRouter(prefix="/gobierno-socios", tags=["socios-gobierno-api"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Socios y Gobierno de API"}


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
