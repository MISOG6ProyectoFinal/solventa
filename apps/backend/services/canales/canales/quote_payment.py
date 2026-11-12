"""Cobro de la prima de una cotización: la misma regla en todos los canales.

El monto sale de la cotización persistida y Pólizas vuelve a compararlo con la prima antes de emitir."""

from urllib.parse import quote

from fastapi import HTTPException
from solventa_common.errors import api_error
from solventa_common.integration.base import call_upstream
from solventa_common.vigencia_cotizacion import oferta_se_puede_cobrar

from canales.clients import cotizacion, pagos

EXPIRED_QUOTE = "cotizacion_vencida"


def payable_quote(quote_id: str, is_owner, not_found: HTTPException, expired_message: str) -> dict:
    """La cotización del dueño que pide el cobro, todavía vigente y con prima."""
    offer = call_upstream(cotizacion.get, f"/consenso/cotizaciones/{quote(quote_id, safe='')}")
    if not isinstance(offer, dict) or offer.get("prima") is None or not is_owner(offer):
        raise not_found
    if not oferta_se_puede_cobrar(offer.get("vigente_hasta")):
        raise api_error(409, EXPIRED_QUOTE, expired_message)
    return offer


def charge_quote(quote_id: str, offer: dict, payer_id: str, idempotency_key: str, payment_token: str) -> dict:
    return call_upstream(
        pagos.post,
        "/pagos/cobros",
        json={
            "cotizacion_id": quote_id,
            "cliente_id": payer_id,
            "monto": str(offer["prima"]),
            "idempotency_key": idempotency_key,
            "medio_token": payment_token,
        },
    )
