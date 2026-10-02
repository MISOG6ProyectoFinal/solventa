"""API Pública de Socios: contrato versionado y aislamiento por socio."""

from typing import Annotated

from fastapi import APIRouter, Header
from solventa_common.app import create_app
from solventa_common.integration import ServiceClient
from solventa_common.integration.base import call_upstream

from api_socios.config import settings

consenso = ServiceClient("validador-consenso", settings.consenso_url)
router = APIRouter(prefix="/socios", tags=["api-socios"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "API Pública de Socios", "versiones": ["v1"]}


@router.post("/v1/cotizaciones")
def cotizar(solicitud: dict, x_api_key: Annotated[str, Header()]) -> dict:
    # TODO: validar x_api_key, alcances y cuota contra Socios y Gobierno de API.
    return call_upstream(consenso.post, "/consenso/cotizaciones", json=solicitud)


app = create_app(settings, routers=[router])
