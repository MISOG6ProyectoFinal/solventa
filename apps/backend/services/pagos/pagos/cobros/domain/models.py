"""Cobro de una prima. El origen es una referencia, no necesariamente una cotización."""

from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import uuid4
from pydantic import BaseModel, Field, field_validator, model_validator


class EstadoCobro(StrEnum):
    PROCESANDO = "procesando"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"


class TipoReferencia(StrEnum):
    COTIZACION = "cotizacion"
    RENOVACION = "renovacion"


class SolicitudCobro(BaseModel):
    """Acepta el contrato histórico de cotización y lo completa con la referencia genérica."""

    cotizacion_id: str | None = None
    tipo_referencia: TipoReferencia | None = None
    referencia_id: str | None = None
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

    @field_validator("idempotency_key", "cliente_id")
    @classmethod
    def _obligatorio(cls, value: str) -> str:
        token = value.strip()
        if not token:
            raise ValueError("El campo es obligatorio")
        return token

    @field_validator("cotizacion_id", "referencia_id")
    @classmethod
    def _opcional_no_vacio(cls, value: str | None) -> str | None:
        if value is None:
            return None
        token = value.strip()
        if not token:
            raise ValueError("El campo es obligatorio")
        return token

    @model_validator(mode="after")
    def _completar_referencia(self) -> "SolicitudCobro":
        if self.tipo_referencia is None:
            if not self.cotizacion_id:
                raise ValueError("La referencia del cobro es obligatoria")
            self.tipo_referencia = TipoReferencia.COTIZACION
            self.referencia_id = self.cotizacion_id
            return self
        if not self.referencia_id:
            raise ValueError("La referencia del cobro es obligatoria")
        if self.tipo_referencia == TipoReferencia.COTIZACION:
            self.cotizacion_id = self.cotizacion_id or self.referencia_id
            return self
        self.cotizacion_id = None
        return self

    def origen(self) -> tuple[TipoReferencia, str]:
        if self.tipo_referencia is None or not self.referencia_id:
            raise ValueError("La referencia del cobro es obligatoria")
        return self.tipo_referencia, self.referencia_id


class Cobro(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tipo_referencia: TipoReferencia
    referencia_id: str
    cotizacion_id: str | None = None
    cliente_id: str
    monto: Decimal
    moneda: str
    estado: EstadoCobro
    idempotency_key: str
    creado_en: datetime = Field(default_factory=lambda: datetime.now(UTC))
