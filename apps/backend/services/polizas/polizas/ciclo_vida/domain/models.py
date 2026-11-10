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
TIPO_ENDOSO_BENEFICIARIOS = "beneficiarios"
TIPO_ENDOSO_SUMA_ASEGURADA = "suma-asegurada"

NOMBRE_ENDOSO_DATOS_ASEGURADO = "Datos del asegurado"
NOMBRE_ENDOSO_BENEFICIARIOS = "Beneficiarios"
NOMBRE_ENDOSO_SUMA_ASEGURADA = "Suma asegurada"

_RAMOS_VIDA = frozenset({"ramo-vida", "ramo-microseguro-vida", "ramo-vida-hipotecario"})
_RAMOS_PATRIMONIAL = frozenset({"ramo-hogar", "ramo-auto", "ramo-dispositivos"})

_TYPES_BASE: dict[str, str] = {TIPO_ENDOSO_DATOS_ASEGURADO: NOMBRE_ENDOSO_DATOS_ASEGURADO}
_TYPES_VIDA: dict[str, str] = {
    TIPO_ENDOSO_DATOS_ASEGURADO: NOMBRE_ENDOSO_DATOS_ASEGURADO,
    TIPO_ENDOSO_BENEFICIARIOS: NOMBRE_ENDOSO_BENEFICIARIOS,
    TIPO_ENDOSO_SUMA_ASEGURADA: NOMBRE_ENDOSO_SUMA_ASEGURADA,
}
_TYPES_PATRIMONIAL: dict[str, str] = {
    TIPO_ENDOSO_DATOS_ASEGURADO: NOMBRE_ENDOSO_DATOS_ASEGURADO,
    TIPO_ENDOSO_SUMA_ASEGURADA: NOMBRE_ENDOSO_SUMA_ASEGURADA,
}

ENDORSEMENT_TYPES: dict[str, str] = _TYPES_BASE


def endorsement_types_for_ramo(ramo_id: str | None = None) -> dict[str, str]:
    if ramo_id in _RAMOS_VIDA:
        return _TYPES_VIDA
    if ramo_id in _RAMOS_PATRIMONIAL:
        return _TYPES_PATRIMONIAL
    return _TYPES_BASE


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
    """El BFF arma la versión anterior (Identidad + endosos previos) y el usuario desde el token del operador."""

    usuario_id: str = Field(min_length=1, max_length=64)
    fecha_efectiva: date
    motivo: str = Field(max_length=255)
    version_anterior: InsuredData
    version_nueva: InsuredData

    @field_validator("motivo")
    @classmethod
    def _motivo(cls, value: str) -> str:
        token = value.strip()
        if not token:
            raise ValueError("El motivo del endoso es obligatorio")
        return token


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
