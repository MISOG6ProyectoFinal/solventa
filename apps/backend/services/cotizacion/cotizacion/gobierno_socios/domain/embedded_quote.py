"""Contrato de la cotización embebida: qué datos pide cada producto al socio (HU014)."""

from decimal import Decimal
from typing import cast

from pydantic import BaseModel, ValidationError

from cotizacion.consenso.domain.models import CoberturaOferta
from cotizacion.gobierno_socios.domain.models import RamoResumen
from cotizacion.rating.domain.models import (
    SolicitudCotizacion,
    SolicitudCotizacionMicroseguroVida,
    SolicitudCotizacionParametrico,
    SolicitudCotizacionViaje,
    SolicitudCotizacionVidaHipotecario,
    SolicitudRating,
)
from cotizacion.rating.domain.rating import REGLAS_VIGENTES
from cotizacion.signals.domain.models import OpenFinanceConsent

# Solventa resuelve el score; el socio no lo puede fijar.
SERVER_OWNED_FIELDS = ("score_riesgo",)


class PartnerMortgageLifeRequest(SolicitudCotizacionVidaHipotecario):
    consentimiento_open_finance: OpenFinanceConsent | None = None


CONTRACTS: dict[str, type[BaseModel]] = {
    "viaje-internacional": SolicitudCotizacionViaje,
    "vida-esencial": SolicitudCotizacionMicroseguroVida,
    "parametrico-clima-vuelo": SolicitudCotizacionParametrico,
    "vida-hipotecario": PartnerMortgageLifeRequest,
}


class QuotableProduct(BaseModel):
    """Lo que el socio puede cotizar hoy y el cuerpo que debe enviar."""

    producto_id: str
    nombre: str
    ramo: RamoResumen
    coberturas: list[CoberturaOferta]
    contrato: dict


def published_contract(product_id: str) -> dict | None:
    """JSON Schema del cuerpo de la cotización. None si Rating aún no tarifa el producto."""
    contract = CONTRACTS.get(product_id)
    if contract is None:
        if product_id not in REGLAS_VIGENTES.tasa_base_por_mil:
            return None
        contract = SolicitudCotizacion
    schema = contract.model_json_schema()
    for field in SERVER_OWNED_FIELDS:
        schema["properties"].pop(field, None)
        if field in schema.get("required", []):
            schema["required"].remove(field)
    schema["properties"]["producto_id"] = {"const": product_id, "type": "string"}
    return schema


_MESSAGES = {
    "missing": "Campo obligatorio",
    "greater_than": "Debe ser mayor que {gt}",
    "greater_than_equal": "Debe ser mayor o igual que {ge}",
    "less_than_equal": "Debe ser menor o igual que {le}",
    "literal_error": "Valor no permitido. Opciones: {expected}",
    "string_too_short": "No puede estar vacío",
    "string_too_long": "Supera la longitud máxima",
}


class InvalidRequest(ValueError):
    def __init__(self, fields: list[dict[str, str]]) -> None:
        self.fields = fields
        super().__init__(fields)


def _message(error: dict) -> str:
    kind = error["type"]
    if kind in _MESSAGES:
        return _MESSAGES[kind].format(**error.get("ctx", {}))
    if kind == "value_error":
        return str(error["msg"]).removeprefix("Value error, ")
    if kind.endswith("_parsing") or kind.endswith("_type"):
        return "Formato inválido"
    return "Valor inválido"


def _invalid_fields(exc: ValidationError) -> list[dict[str, str]]:
    return [
        {"campo": ".".join(str(part) for part in error["loc"]) or "solicitud", "error": _message(error)}
        for error in exc.errors()
    ]


def requested_product(data: dict) -> str:
    product_id = data.get("producto_id")
    if not isinstance(product_id, str) or not product_id.strip():
        raise InvalidRequest([{"campo": "producto_id", "error": "Campo obligatorio"}])
    return product_id.strip()


def validate_contract(data: dict) -> BaseModel:
    """Valida contra el contrato del producto. Lanza InvalidRequest con cada campo y su motivo."""
    cleaned = {key: value for key, value in data.items() if key not in SERVER_OWNED_FIELDS}
    contract = CONTRACTS.get(requested_product(data), SolicitudCotizacion)
    try:
        return contract.model_validate(cleaned)
    except ValidationError as exc:
        raise InvalidRequest(_invalid_fields(exc)) from exc


def to_rating_request(contract: BaseModel, risk_score: Decimal | None = None) -> SolicitudRating:
    """Quita lo que es del canal y deja solo lo que calcula Rating."""
    if isinstance(contract, PartnerMortgageLifeRequest):
        data = contract.model_dump(exclude={"consentimiento_open_finance"})
        if risk_score is not None:
            data["score_riesgo"] = risk_score
        return SolicitudCotizacionVidaHipotecario(**data)
    return cast(SolicitudRating, contract)
