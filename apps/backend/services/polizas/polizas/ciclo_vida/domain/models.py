"""Póliza emitida a partir de una cotización vigente y un cobro aprobado."""

from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


class PolicyStatus(StrEnum):
    ACTIVE = "activa"
    CANCELLED = "cancelada"
    EXPIRED = "vencida"  # derivado: activa con vigencia pasada, no se guarda


class Coverage(BaseModel):
    id: str
    nombre: str

    @model_validator(mode="before")
    @classmethod
    def _formato_sembrado(cls, value):
        """Las pólizas sembradas guardan {name, included}; se leen como {id, nombre}."""
        if isinstance(value, dict) and "nombre" not in value and "name" in value:
            return {"id": value.get("id", value["name"]), "nombre": value["name"]}
        return value


class Beneficiary(BaseModel):
    nombre: str
    parentesco: str
    porcentaje: Decimal


class Validity(BaseModel):
    desde: date
    hasta: date


class IssuePolicyRequest(BaseModel):
    """El canal identifica al dueño de la cotización: socio_id para socios, cliente_id para móvil."""

    cotizacion_id: str = Field(min_length=1, max_length=64)
    cobro_id: str = Field(min_length=1, max_length=64)
    idempotency_key: str = Field(min_length=1, max_length=255)
    canal: Literal["socios", "mobile"]
    socio_id: str | None = None
    cliente_id: str | None = None

    @field_validator("cotizacion_id", "cobro_id", "idempotency_key")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


def _policy_number() -> str:
    return f"POL-{uuid4().hex[:10].upper()}"


class Policy(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    numero: str = Field(default_factory=_policy_number)
    estado: PolicyStatus = PolicyStatus.ACTIVE
    cotizacion_id: str
    cobro_id: str
    producto_id: str
    prima: Decimal
    coberturas: list[Coverage] = Field(default_factory=list)
    vigencia: Validity
    canal: str
    socio_id: str | None = None
    cliente_id: str | None = None
    idempotency_key: str
    emitida_en: datetime = Field(default_factory=lambda: datetime.now(UTC))
