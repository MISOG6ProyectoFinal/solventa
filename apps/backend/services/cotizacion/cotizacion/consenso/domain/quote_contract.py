"""Contrato de entrada de una cotización, el mismo para móvil, portal web y socios."""

from datetime import date
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ValidationError, model_validator
from solventa_common.validation import invalid_fields

from cotizacion.rating.domain.models import (
    RATING_REQUESTS,
    SolicitudCotizacionViaje,
    SolicitudCotizacionVidaHipotecario,
    SolicitudRating,
    parse_rating_request,
    rating_request_type,
)
from cotizacion.rating.domain.rating import ReglasRating
from cotizacion.signals.domain.models import OpenFinanceConsent

SERVER_OWNED_FIELDS = ("score_riesgo", "cliente_id")


class TravelQuoteRequest(SolicitudCotizacionViaje):
    @model_validator(mode="after")
    def _departure_not_in_the_past(self) -> Self:
        if self.fecha_salida < date.today():
            raise ValueError("La fecha de salida no puede ser anterior a hoy")
        return self


class MortgageLifeQuoteRequest(SolicitudCotizacionVidaHipotecario):
    consentimiento_open_finance: OpenFinanceConsent | None = None


CONTRACTS: dict[str, type[BaseModel]] = {
    **RATING_REQUESTS,
    "viaje-internacional": TravelQuoteRequest,
    "vida-hipotecario": MortgageLifeQuoteRequest,
}


class InvalidRequest(ValueError):
    def __init__(self, fields: list[dict[str, str]]) -> None:
        self.fields = fields
        super().__init__(fields)


def _contract(product_id: str) -> type[BaseModel]:
    return CONTRACTS.get(product_id) or rating_request_type(product_id)


def published_contract(product_id: str, reglas: ReglasRating) -> dict | None:
    """JSON Schema del cuerpo de la cotización. None si Rating aún no tarifa el producto."""
    if product_id not in CONTRACTS and product_id not in reglas.tasa_base_por_mil:
        return None
    schema = _contract(product_id).model_json_schema()
    for field in SERVER_OWNED_FIELDS:
        schema["properties"].pop(field, None)
        if field in schema.get("required", []):
            schema["required"].remove(field)
    schema["properties"]["producto_id"] = {"const": product_id, "type": "string"}
    return schema


def requested_product(data: dict) -> str:
    product_id = data.get("producto_id")
    if not isinstance(product_id, str) or not product_id.strip():
        raise InvalidRequest([{"campo": "producto_id", "error": "Campo obligatorio"}])
    return product_id.strip()


def validate_contract(data: dict) -> BaseModel:
    """Valida contra el contrato del producto. Lanza InvalidRequest con cada campo y su motivo."""
    product_id = requested_product(data)
    cleaned = {key: value for key, value in data.items() if key not in SERVER_OWNED_FIELDS}
    try:
        return _contract(product_id).model_validate({**cleaned, "producto_id": product_id})
    except ValidationError as exc:
        raise InvalidRequest(invalid_fields(exc)) from exc


def open_finance_consent(contract: BaseModel) -> OpenFinanceConsent | None:
    return getattr(contract, "consentimiento_open_finance", None)


def to_rating_request(contract: BaseModel, risk_score: Decimal | None = None) -> SolicitudRating:
    """Quita lo que es del canal y deja solo lo que calcula Rating."""
    data = contract.model_dump(exclude={"consentimiento_open_finance"})
    if risk_score is not None:
        data["score_riesgo"] = risk_score
    return parse_rating_request(data)
