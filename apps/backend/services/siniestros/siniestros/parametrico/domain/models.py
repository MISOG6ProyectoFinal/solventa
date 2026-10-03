from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class EventoParametrico(BaseModel):
    """Hecho observado por una fuente externa (Open Data), con su valor y la póliza expuesta."""

    fuente: str = Field(examples=["ideam"])
    clave_evento: str = Field(description="Identificador del evento en la fuente; base de la idempotencia")
    poliza_id: str
    tipo: str = Field(examples=["precipitacion_mm"])
    valor_observado: Decimal
    umbral: Decimal = Field(description="Cobertura.umbralParametrico")
    monto_asegurado: Decimal = Field(gt=0)
    observado_en: datetime

    @property
    def idempotency_key(self) -> str:
        return f"{self.fuente}:{self.clave_evento}:{self.poliza_id}"

    def supera_umbral(self) -> bool:
        return self.valor_observado >= self.umbral


class Liquidacion(BaseModel):
    idempotency_key: str
    poliza_id: str
    monto: Decimal
    evento: str
