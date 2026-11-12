from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Response, status
from pydantic import BaseModel, Field
from solventa_common.integration.base import call_upstream
from solventa_common.vigencia_cotizacion import oferta_se_puede_cobrar

from canales.clients import cotizacion, pagos, polizas, siniestros

ClientId = Annotated[str, Header(alias="X-Client-Id")]
ApiKey = Annotated[str, Header(alias="X-Api-Key")]
IdempotencyKey = Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=100)]
ResourceId = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,64}$")]

SUPPORTED_VERSIONS = ("v1",)
POLICY_FIELDS = ("id", "numero", "estado", "cotizacion_id", "producto_id", "prima", "coberturas", "vigencia")
CLAIM_FIELDS = ("id", "radicado", "estado", "poliza_id", "tipo", "ocurrido_en")

router = APIRouter(prefix="/socios", tags=["API Pública de Socios"])


def _authorize(client_id: str, api_key: str, scope: str) -> dict:
    return call_upstream(
        cotizacion.get,
        "/gobierno-socios/autorizacion",
        params={"alcance": scope},
        headers={"X-Client-Id": client_id, "X-Api-Key": api_key},
    )


def _rate_limit_headers(usage: dict) -> dict[str, str]:
    return {
        "X-RateLimit-Limit": str(usage["cuota_consumo"]),
        "X-RateLimit-Remaining": str(max(0, usage["cuota_consumo"] - usage["consumidas"])),
        "X-RateLimit-Reset": str(usage["reinicia_en_s"]),
    }


def _quota_exceeded(usage: dict, headers: dict[str, str]) -> HTTPException:
    quota = usage["cuota_consumo"]
    detail = {
        "codigo": "cuota_excedida",
        "mensaje": f"Se superó la cuota de {quota} solicitudes por minuto. Intente de nuevo más tarde.",
    }
    retry = {"Retry-After": headers["X-RateLimit-Reset"]}
    return HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail, headers=headers | retry)


def _admit(scope: str, response: Response, client_id: str, api_key: str) -> dict:
    partner = _authorize(client_id, api_key, scope)
    usage = partner.get("consumo")
    if usage is None:
        return partner
    headers = _rate_limit_headers(usage)
    if not usage["permitido"]:
        raise _quota_exceeded(usage, headers)
    response.headers.update(headers)
    return partner


def _quoting_gateway(response: Response, x_client_id: ClientId, x_api_key: ApiKey) -> dict:
    return _admit("cotizacion", response, x_client_id, x_api_key)


def _issuing_gateway(
    response: Response, x_client_id: ClientId, x_api_key: ApiKey, _idempotency_key: IdempotencyKey
) -> dict:
    return _admit("emision", response, x_client_id, x_api_key)


def _reading_gateway(response: Response, x_client_id: ClientId, x_api_key: ApiKey) -> dict:
    return _admit("consulta", response, x_client_id, x_api_key)


QuotingPartner = Annotated[dict, Depends(_quoting_gateway)]
IssuingPartner = Annotated[dict, Depends(_issuing_gateway)]
ReadingPartner = Annotated[dict, Depends(_reading_gateway)]


@router.get("/")
def info() -> dict:
    return {"component": "API Pública de Socios", "versiones": list(SUPPORTED_VERSIONS)}


@router.get("/v1/productos")
def products(_partner: QuotingPartner, x_client_id: ClientId, x_api_key: ApiKey) -> list:
    """Productos cotizables del socio, con sus coberturas habilitadas y el contrato de cada uno."""
    return call_upstream(
        cotizacion.get,
        "/gobierno-socios/catalogo",
        headers={"X-Client-Id": x_client_id, "X-Api-Key": x_api_key},
    )


@router.post("/v1/cotizaciones")
def cotizar(solicitud: dict, _partner: QuotingPartner, x_client_id: ClientId, x_api_key: ApiKey) -> dict:
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
    partner: IssuingPartner,
    idempotency_key: IdempotencyKey,
) -> dict:
    """Cobra la prima de una cotización vigente del socio. El monto sale de Cotización, no del socio."""
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
            "idempotency_key": f"socios:{partner['socio_id']}:{idempotency_key}",
            "medio_token": request.medio_token,
        },
    )
    return {key: payment[key] for key in ("id", "cotizacion_id", "estado", "monto", "moneda")}


@router.post("/v1/polizas", status_code=status.HTTP_201_CREATED)
def issue_policy(
    request: PartnerIssueRequest,
    partner: IssuingPartner,
    idempotency_key: IdempotencyKey,
) -> dict:
    """Emite la póliza de una cotización pagada. La misma Idempotency-Key devuelve la misma póliza."""
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
    return {key: policy[key] for key in POLICY_FIELDS}


def _out_of_scope() -> HTTPException:
    detail = {"codigo": "recurso_fuera_de_alcance", "mensaje": "El recurso no pertenece al socio."}
    return HTTPException(status.HTTP_403_FORBIDDEN, detail)


@router.get("/v1/polizas/{poliza_id}")
def get_policy(poliza_id: ResourceId, partner: ReadingPartner) -> dict:
    """Estado vigente y datos principales de una póliza emitida por este socio."""
    policy = call_upstream(polizas.get, f"/polizas/{poliza_id}")
    if policy.get("socio_id") != partner["socio_id"]:
        raise _out_of_scope()
    return {key: policy[key] for key in POLICY_FIELDS}


@router.get("/v1/siniestros/{siniestro_id}")
def get_claim(siniestro_id: ResourceId, partner: ReadingPartner) -> dict:
    """Un siniestro es del socio cuando la póliza a la que pertenece la emitió ese socio."""
    claim = call_upstream(siniestros.get, f"/siniestros/avisos/{siniestro_id}")
    try:
        policy = call_upstream(polizas.get, f"/polizas/{quote(claim['poliza_id'], safe='')}")
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            raise _out_of_scope() from exc
        raise
    if policy.get("socio_id") != partner["socio_id"]:
        raise _out_of_scope()
    return {key: claim[key] for key in CLAIM_FIELDS}
