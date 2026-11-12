"""Póliza emitida a partir de una cotización vigente y un cobro aprobado."""

from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    causa_cancelacion: CancellationCause | None = None
    fecha_cancelacion: date | None = None


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


class RenewalRequest(BaseModel):
    """El teléfono solo identifica el cobro. La vigencia y la prima salen de la póliza y de Pagos."""

    model_config = ConfigDict(extra="ignore")
    cobro_id: str = Field(min_length=1, max_length=64)

    @field_validator("cobro_id")
    @classmethod
    def _cobro(cls, value: str) -> str:
        token = value.strip()
        if not token:
            raise ValueError("El pago es obligatorio")
        return token


class Renewal(BaseModel):
    """Ciclo ya aplicado. Conserva la vigencia anterior y la nueva sin reemplazar la póliza."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    poliza_id: str
    ciclo: str
    cobro_id: str
    vigencia_anterior: Validity
    vigencia_nueva: Validity
    prima_anterior: Decimal
    prima_nueva: Decimal
    aplicada_en: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RenewalConfirmation(BaseModel):
    poliza_id: str
    numero_poliza: str
    producto_id: str
    estado: Literal["aplicada"] = "aplicada"
    cobro_id: str
    vigencia_anterior: Validity
    vigencia_nueva: Validity
    coberturas: list[Coverage]


class AppliedRenewal(BaseModel):
    """Renovación comprada cuya vigencia todavía no reemplaza la cobertura en curso."""

    estado: Literal["aplicada"] = "aplicada"
    cobro_id: str
    vigencia_nueva: Validity


class ClientPolicy(Policy):
    """Listado del cliente. `renovable` y `renovacion` se calculan; no forman parte de la póliza guardada."""

    renovable: bool
    renovacion: AppliedRenewal | None = None


TIPO_ENDOSO_DATOS_ASEGURADO = "datos-asegurado"


class EndorsementType(CatalogOption):
    ramos: list[str] = Field(default_factory=list)

    def applies_to(self, ramo_id: str | None) -> bool:
        return not self.ramos or ramo_id in self.ramos


class InsuredData(BaseModel):
    """Datos del asegurado que un endoso puede cambiar. No se escriben en Identidad."""

    nombre: str = Field(min_length=1, max_length=120)
    telefono: str = Field(max_length=40)
    correo: str = Field(max_length=120)
    direccion: str = Field(max_length=200)

    @field_validator("*")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


class EndorsementRequest(BaseModel):
    """El BFF envía lo que dice Identidad y el usuario del token. Pólizas decide la versión vigente del asegurado."""

    usuario_id: str = Field(min_length=1, max_length=64)
    fecha_efectiva: date
    motivo: str = Field(max_length=255)
    datos_identidad: InsuredData
    version_nueva: InsuredData

    @field_validator("motivo")
    @classmethod
    def _motivo(cls, value: str) -> str:
        token = value.strip()
        if not token:
            raise ValueError("El motivo del endoso es obligatorio")
        return token


class CurrentInsured(BaseModel):
    """Datos del asegurado según el último endoso. None si nunca se endosó: valen los de Identidad."""

    asegurado: InsuredData | None


class Endorsement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    poliza_id: str
    tipo: str = TIPO_ENDOSO_DATOS_ASEGURADO
    fecha_efectiva: date
    motivo: str
    usuario_id: str = ""
    version_anterior: dict = Field(default_factory=dict)
    version_nueva: dict = Field(default_factory=dict)
    creado_en: datetime = Field(default_factory=lambda: datetime.now(UTC))


class NamedEndorsement(Endorsement):
    tipo_nombre: str


class CancellationQuoteRequest(BaseModel):
    causa: CancellationCause


class CancellationRequest(CancellationQuoteRequest):
    """El BFF pone el usuario desde el token del operador."""

    usuario_id: str = Field(min_length=1, max_length=64)


class CancellationQuote(BaseModel):
    """Devolución calculada por Cotización y Rating. Pólizas no calcula el prorrateo."""

    dias_vigencia: int
    dias_no_devengados: int
    monto_reintegro: Decimal
