from typing import Literal

from pydantic import BaseModel, Field

TipoPrestador = Literal["grua", "taller", "perito", "ambulancia"]

MAX_RADIO_KM = 50
MAX_RESULTADOS = 50


class Prestador(BaseModel):
    origen: Literal["seed", "osm"]
    origen_id: str
    nombre: str
    tipo: TipoPrestador
    latitud: float
    longitud: float
    calificacion: float | None = Field(default=None, ge=1, le=5)

    @property
    def id(self) -> str:
        return f"{self.origen}-{self.origen_id}"


class ConsultaCercanos(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    radio_km: float = Field(default=10, gt=0, le=MAX_RADIO_KM)
    servicio: TipoPrestador | None = None


class PrestadorCercano(BaseModel):
    prestador: Prestador
    distancia_km: float
    eta_min: int
