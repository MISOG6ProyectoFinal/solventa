"""Entrada HTTP de Identidad, Consentimiento y KYC."""

from fastapi import APIRouter
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from identidad_kyc.config import settings

engine = optional_engine(settings.database_url)
router = APIRouter(prefix="/identidad", tags=["identidad-kyc"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Identidad, Consentimiento y KYC"}


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
