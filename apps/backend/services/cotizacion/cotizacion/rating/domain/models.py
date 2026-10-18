from datetime import date
from decimal import Decimal
from typing import Literal, Self

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
    def _regreso_posterior_a_salida(self) -> Self:
        if self.fecha_regreso <= self.fecha_salida:
            raise ValueError("La fecha de regreso debe ser posterior a la fecha de salida")
        return self


class SolicitudCotizacionMicroseguroVida(BaseModel):
    producto_id: str
    fecha_nacimiento: date
    suma_asegurada: Decimal = Field(gt=0)
    beneficiario: str
    parentesco: Literal["Cónyuge", "Hijo(a)", "Padre / Madre", "Otro"]


class SolicitudCotizacionVidaHipotecario(BaseModel):
    producto_id: str
    fecha_nacimiento: date
    entidad: str
    valor_credito: Decimal = Field(gt=0)
    plazo_anios: int = Field(ge=1)


class SolicitudCotizacionParametrico(BaseModel):
    producto_id: str
    evento: Literal["Retraso de vuelo", "Lluvia excesiva"]
    referencia: str
    fecha_evento: date
    valor_indemnizar: Decimal = Field(gt=0)


SolicitudRating = (
    SolicitudCotizacionViaje
    | SolicitudCotizacionMicroseguroVida
    | SolicitudCotizacionVidaHipotecario
    | SolicitudCotizacionParametrico
    | SolicitudCotizacion
)


class Cotizacion(BaseModel):
    producto_id: str
    prima: Decimal
    version_reglas: str
    instancia: str
