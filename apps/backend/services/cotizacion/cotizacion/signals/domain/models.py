from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field


class SignalOrigin(StrEnum):
    PROVIDER = "proveedor"
    CACHE = "cache"
    DEFAULT = "valor_por_defecto"


class DegradationReason(StrEnum):
    TIMEOUT = "timeout"
    CIRCUIT_OPEN = "circuito_abierto"
    PROVIDER_ERROR = "error_proveedor"
    INVALID_RESPONSE = "respuesta_invalida"


class AppliedSignal(BaseModel):
    """Qué señal entró al precio y de dónde salió, para reconstruir la decisión (ASR-10)."""

    fuente: str
    origen: SignalOrigin
    score_riesgo: Decimal = Field(ge=0, le=1)
    latencia_ms: int = Field(ge=0)
    motivo: DegradationReason | None = None
    obtenido_en: datetime | None = None

    @property
    def degraded(self) -> bool:
        return self.origen is not SignalOrigin.PROVIDER


class OpenFinanceConsent(BaseModel):
    referencia_cliente: str = Field(min_length=1, max_length=120)
    consentimiento_id: str = Field(min_length=1, max_length=120)


NEUTRAL_RISK_SCORE = Decimal("0.5")
