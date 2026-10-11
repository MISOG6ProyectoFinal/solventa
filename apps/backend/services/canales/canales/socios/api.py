from typing import Annotated

from fastapi import APIRouter, Header
from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion

router = APIRouter(prefix="/socios", tags=["API Pública de Socios"])


@router.get("/")
def info() -> dict:
    return {"component": "API Pública de Socios", "versiones": ["v1"]}


@router.post("/v1/cotizaciones")
def cotizar(
    solicitud: dict,
    x_client_id: Annotated[str, Header()],
    x_api_key: Annotated[str, Header()],
) -> dict:
    """Gobierno de API reconoce las credenciales y el alcance antes de cotizar."""
    return call_upstream(
        cotizacion.post,
        "/gobierno-socios/cotizaciones",
        json=solicitud,
        headers={"X-Client-Id": x_client_id, "X-Api-Key": x_api_key},
    )
