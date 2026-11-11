"""Prima no devengada: la parte de la prima de los días que la póliza ya no cubre."""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field, model_validator


class SolicitudDevolucion(BaseModel):
    """Datos de la póliza y fechas clave. Pólizas decide si la causa es reembolsable."""

    prima: Decimal = Field(ge=0)
    fecha_inicio: date
    fecha_fin: date
    fecha_cancelacion: date
    reembolsable: bool = True

    @model_validator(mode="after")
    def _fechas(self) -> "SolicitudDevolucion":
        if not self.fecha_inicio <= self.fecha_cancelacion <= self.fecha_fin:
            raise ValueError("La fecha de cancelación debe estar dentro de la vigencia")
        return self


class Devolucion(BaseModel):
    dias_vigencia: int
    dias_no_devengados: int
    monto_reintegro: Decimal


def calcular_devolucion(solicitud: SolicitudDevolucion) -> Devolucion:
    dias_vigencia = max(1, (solicitud.fecha_fin - solicitud.fecha_inicio).days)
    no_devengados = (solicitud.fecha_fin - solicitud.fecha_cancelacion).days
    monto = Decimal(0)
    if solicitud.reembolsable:
        monto = (solicitud.prima * no_devengados / dias_vigencia).quantize(Decimal(1), ROUND_HALF_UP)
    return Devolucion(dias_vigencia=dias_vigencia, dias_no_devengados=no_devengados, monto_reintegro=monto)
