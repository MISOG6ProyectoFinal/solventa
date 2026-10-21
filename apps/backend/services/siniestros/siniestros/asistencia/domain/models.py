from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

Servicio = Literal["grua", "ambulancia", "perito"]


class NuevaAsistencia(BaseModel):
    servicio: Servicio
    ubicacion: str
    gps: str | None = None

    @field_validator("ubicacion")
    @classmethod
    def _ubicacion_obligatoria(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("La ubicación es obligatoria")
        return value.strip()


class Despacho(BaseModel):
    numero: str
    eta_min: int
    eta_max: int


class Asistencia(BaseModel):
    id: str
    aviso_id: str
    cliente_id: str
    servicio: Servicio
    ubicacion: str
    gps: str | None = None
    numero: str
    eta_min: int
    eta_max: int
    estado: str = "solicitada"
    solicitada_en: datetime
