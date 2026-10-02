from decimal import Decimal

from pydantic import BaseModel, Field


class SolicitudCotizacion(BaseModel):
    producto_id: str
    suma_asegurada: Decimal = Field(gt=0)
    edad: int = Field(ge=18, le=99)
    score_riesgo: Decimal = Field(default=Decimal("0.5"), ge=0, le=1)


class Cotizacion(BaseModel):
    producto_id: str
    prima: Decimal
    version_reglas: str
    instancia: str
