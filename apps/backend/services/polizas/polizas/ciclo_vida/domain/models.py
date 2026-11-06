"""Póliza emitida a partir de una cotización vigente y un cobro aprobado."""

from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class PolicyStatus(StrEnum):
    ACTIVE = "activa"
    EXPIRED = "vencida"
    CANCELLED = "cancelada"


class CancellationCause(StrEnum):
    WITHDRAWAL = "retracto"
    INSURED_ASSET_SOLD = "venta-del-bien-asegurado"
    SERVICE_DISSATISFACTION = "insatisfaccion-con-el-servicio"
    ASSOCIATED_CREDIT_PREPAID = "pago-anticipado-del-credito-asociado"
    PREMIUM_NON_PAYMENT = "impago-de-prima"


class CatalogOption(BaseModel):
    id: str
    nombre: str


class CancellationCauseOption(CatalogOption):
    reembolsable: bool


STATUS_NAMES: dict[PolicyStatus, str] = {
    PolicyStatus.ACTIVE: "Activa",
    PolicyStatus.EXPIRED: "Vencida",
    PolicyStatus.CANCELLED: "Cancelada",
}

CANCELLATION_CAUSE_NAMES: dict[CancellationCause, str] = {
    CancellationCause.WITHDRAWAL: "Retracto",
    CancellationCause.INSURED_ASSET_SOLD: "Venta del bien asegurado",
    CancellationCause.SERVICE_DISSATISFACTION: "Insatisfacción con el servicio",
    CancellationCause.ASSOCIATED_CREDIT_PREPAID: "Pago anticipado del crédito asociado",
    CancellationCause.PREMIUM_NON_PAYMENT: "Impago de prima",
}

NON_REFUNDABLE_CAUSES = frozenset({CancellationCause.PREMIUM_NON_PAYMENT})


class Coverage(BaseModel):
    id: str
    nombre: str


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


class RenewalOffer(BaseModel):
    """Consulta de la próxima vigencia. No es una póliza y no se persiste."""

    poliza_id: str
    numero_poliza: str
    producto_id: str
    prima_actual: Decimal
    prima_propuesta: Decimal
    vigencia_actual: Validity
    vigencia_propuesta: Validity
    coberturas_propuestas: list[Coverage]


class ClientPolicy(Policy):
    """Listado del cliente. `renovable` se calcula; no forma parte de la póliza guardada."""

    renovable: bool
