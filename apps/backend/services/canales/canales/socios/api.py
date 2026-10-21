from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field
from solventa_common.integration.base import call_upstream
from solventa_common.vigencia_cotizacion import oferta_se_puede_cobrar

from canales.clients import cotizacion, pagos, polizas

ClientId = Annotated[str, Header(alias="X-Client-Id")]
ApiKey = Annotated[str, Header(alias="X-Api-Key")]
IdempotencyKey = Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=100)]

router = APIRouter(prefix="/socios", tags=["API Pública de Socios"])


@router.get("/")
def info() -> dict:
    return {"component": "API Pública de Socios", "versiones": ["v1"]}


@router.get("/v1/productos")
def products(
    x_client_id: Annotated[str, Header()],
    x_api_key: Annotated[str, Header()],
) -> list:
    """Productos cotizables del socio, con sus coberturas habilitadas y el contrato de cada uno."""
    return call_upstream(
        cotizacion.get,
        "/gobierno-socios/catalogo",
        headers={"X-Client-Id": x_client_id, "X-Api-Key": x_api_key},
    )


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


class PartnerPaymentRequest(BaseModel):
    """El socio envía el token que le entregó la pasarela; Solventa nunca recibe el número de tarjeta."""

    medio_token: str = Field(min_length=1, max_length=255)


class PartnerIssueRequest(BaseModel):
    cotizacion_id: str = Field(min_length=1, max_length=64)
    cobro_id: str = Field(min_length=1, max_length=64)


def _authorize(client_id: str, api_key: str, scope: str) -> dict:
    return call_upstream(
        cotizacion.get,
        "/gobierno-socios/autorizacion",
        params={"alcance": scope},
        headers={"X-Client-Id": client_id, "X-Api-Key": api_key},
    )


def _partner_quote(quote_id: str, partner_id: str) -> dict:
    quote = call_upstream(cotizacion.get, f"/consenso/cotizaciones/{quote_id}")
    if not isinstance(quote, dict) or quote.get("socio_id") != partner_id:
        detail = {"codigo": "cotizacion_no_encontrada", "mensaje": "La cotización no existe."}
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail)
    return quote


@router.post("/v1/cotizaciones/{cotizacion_id}/pagos")
def pay_quote(
    cotizacion_id: str,
    request: PartnerPaymentRequest,
    x_client_id: ClientId,
    x_api_key: ApiKey,
    idempotency_key: IdempotencyKey,
) -> dict:
    """Cobra la prima de una cotización vigente del socio. El monto sale de Cotización, no del socio."""
    partner = _authorize(x_client_id, x_api_key, "emision")
    quote = _partner_quote(cotizacion_id, partner["socio_id"])
    if not oferta_se_puede_cobrar(quote.get("vigente_hasta")):
        detail = {
            "codigo": "cotizacion_vencida",
            "mensaje": "La cotización ya no está vigente. No se realizó ningún cobro; vuelva a cotizar.",
        }
        raise HTTPException(status.HTTP_409_CONFLICT, detail)
    payment = call_upstream(
        pagos.post,
        "/pagos/cobros",
        json={
            "cotizacion_id": cotizacion_id,
            "cliente_id": f"socio:{partner['socio_id']}",
            "monto": str(quote["prima"]),
            "moneda": "COP",
            "idempotency_key": f"socios:{partner['socio_id']}:{idempotency_key}",
            "medio_token": request.medio_token,
        },
    )
    return {key: payment[key] for key in ("id", "cotizacion_id", "estado", "monto", "moneda")}


@router.post("/v1/polizas", status_code=status.HTTP_201_CREATED)
def issue_policy(
    request: PartnerIssueRequest,
    x_client_id: ClientId,
    x_api_key: ApiKey,
    idempotency_key: IdempotencyKey,
) -> dict:
    """Emite la póliza de una cotización pagada. La misma Idempotency-Key devuelve la misma póliza."""
    partner = _authorize(x_client_id, x_api_key, "emision")
    policy = call_upstream(
        polizas.post,
        "/polizas/emisiones",
        json={
            "cotizacion_id": request.cotizacion_id,
            "cobro_id": request.cobro_id,
            "idempotency_key": f"socios:{partner['socio_id']}:{idempotency_key}",
            "canal": "socios",
            "socio_id": partner["socio_id"],
        },
    )
    fields = ("id", "numero", "estado", "cotizacion_id", "producto_id", "prima", "coberturas", "vigencia")
    return {key: policy[key] for key in fields}
