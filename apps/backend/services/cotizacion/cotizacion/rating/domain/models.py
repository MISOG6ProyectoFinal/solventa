from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class SolicitudCotizacion(BaseModel):
    producto_id: str
    suma_asegurada: Decimal = Field(gt=0)
    edad: int = Field(ge=18, le=99)
    score_riesgo: Decimal = Field(default=Decimal("0.5"), ge=0, le=1)


class SolicitudCotizacionViaje(BaseModel):
    producto_id: str
    destino: Literal["Estados Unidos", "España", "México", "Otro país"]
    fecha_salida: date
    fecha_regreso: date
    viajeros: int = Field(ge=1)

    @model_validator(mode="after")
    def _regreso_posterior_a_salida(self) -> "SolicitudCotizacionViaje":
        if self.fecha_regreso <= self.fecha_salida:
            raise ValueError("La fecha de regreso debe ser posterior a la fecha de salida")
        return self


SolicitudRating = SolicitudCotizacionViaje | SolicitudCotizacion


class Cotizacion(BaseModel):
    producto_id: str
    prima: Decimal
    version_reglas: str
    instancia: str
