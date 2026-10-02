"""Entrada HTTP de Pólizas y Ciclo de Vida."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from polizas.config import settings

engine = optional_engine(settings.database_url)
router = APIRouter(prefix="/polizas", tags=["polizas"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Pólizas y Ciclo de Vida"}


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
