from typing import Annotated

from fastapi import APIRouter, Header
from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion

router = APIRouter(prefix="/socios", tags=["API Pública de Socios"])


@router.get("/")
def info() -> dict:
    return {"component": "API Pública de Socios", "versiones": ["v1"]}


@router.post("/v1/cotizaciones")
def cotizar(solicitud: dict, x_api_key: Annotated[str, Header()]) -> dict:
    # TODO: validar x_api_key, alcances y cuota contra Socios y Gobierno de API (servicio cotizacion).
    return call_upstream(
        cotizacion.post,
        "/consenso/cotizaciones",
        json=solicitud,
        headers={"X-Canal": "socios"},
    )
