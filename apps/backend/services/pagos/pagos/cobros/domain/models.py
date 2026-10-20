"""Cobro de la prima de una cotización. No guarda datos de tarjeta."""

from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class EstadoCobro(StrEnum):
    PROCESANDO = "procesando"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"


class SolicitudCobro(BaseModel):
    cotizacion_id: str
    cliente_id: str
    monto: Decimal
    moneda: str = "COP"
    idempotency_key: str
    medio_token: str

    @field_validator("monto")
    @classmethod
    def _monto_positivo(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("El monto debe ser positivo")
        return value.quantize(Decimal("0.01"))

    @field_validator("medio_token")
    @classmethod
    def _sin_pan(cls, value: str) -> str:
        token = value.strip()
        if token.isdigit() and len(token) >= 12:
            raise ValueError("No se aceptan números de tarjeta")
        if not token:
            raise ValueError("El medio de pago es obligatorio")
        return token

    @field_validator("idempotency_key", "cotizacion_id", "cliente_id")
    @classmethod
    def _obligatorio(cls, value: str) -> str:
        token = value.strip()
        if not token:
            raise ValueError("El campo es obligatorio")
        return token


class Cobro(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    cotizacion_id: str
    cliente_id: str
    monto: Decimal
    moneda: str
    estado: EstadoCobro
    idempotency_key: str
    creado_en: datetime = Field(default_factory=lambda: datetime.now(UTC))
