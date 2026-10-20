from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field


class OrigenSenal(StrEnum):
    PROVEEDOR = "proveedor"
    CACHE = "cache"
    VALOR_POR_DEFECTO = "valor_por_defecto"


class SenalAplicada(BaseModel):
    """Qué señal entró al precio y de dónde salió, para reconstruir la decisión (ASR-10)."""

    fuente: str
    origen: OrigenSenal
    score_riesgo: Decimal = Field(ge=0, le=1)
    latencia_ms: int = Field(ge=0)

    @property
    def degradada(self) -> bool:
        return self.origen is not OrigenSenal.PROVEEDOR


class ConsentimientoOpenFinance(BaseModel):
    referencia_cliente: str = Field(min_length=1, max_length=120)
    consentimiento_id: str = Field(min_length=1, max_length=120)


RIESGO_NEUTRAL = Decimal("0.5")
