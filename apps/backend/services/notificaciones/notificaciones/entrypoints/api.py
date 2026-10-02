"""Entrada HTTP de Notificaciones."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from notificaciones.config import settings

engine = optional_engine(settings.database_url)
router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Notificaciones"}


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
