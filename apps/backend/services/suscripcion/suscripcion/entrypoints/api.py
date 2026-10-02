"""Entrada HTTP de Suscripción."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from suscripcion.config import settings

engine = optional_engine(settings.database_url)
router = APIRouter(prefix="/suscripciones", tags=["suscripcion"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Suscripción"}


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
