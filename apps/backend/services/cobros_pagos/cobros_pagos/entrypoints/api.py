"""Entrada HTTP de Cobros y Pagos."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from cobros_pagos.config import settings

engine = optional_engine(settings.database_url)
router = APIRouter(prefix="/pagos", tags=["cobros-pagos"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Cobros y Pagos"}


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
