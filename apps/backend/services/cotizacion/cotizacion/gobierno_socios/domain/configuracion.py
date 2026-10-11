"""Ramos y coberturas que un socio puede vender según su acuerdo comercial."""

from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field

from cotizacion.gobierno_socios.domain.models import Texto


def _sin_repetidas(coberturas: list[str]) -> list[str]:
    return list(dict.fromkeys(coberturas))


class RamoHabilitado(BaseModel):
    ramo_id: str
    coberturas: Annotated[list[str], AfterValidator(_sin_repetidas)] = Field(default_factory=list)


def _ramos_unicos(ramos: list[RamoHabilitado]) -> list[RamoHabilitado]:
    ids = [ramo.ramo_id for ramo in ramos]
    if len(ids) != len(set(ids)):
        raise ValueError("Cada ramo puede aparecer una sola vez")
    return ramos


class ConfiguracionSocio(BaseModel):
    """Configuración vigente. Un ramo ausente está deshabilitado."""

    socio_id: str
    ramos: list[RamoHabilitado] = Field(default_factory=list)
    actualizado_en: datetime | None = None
    actualizado_por: str | None = None

    def ramos_habilitados(self) -> set[str]:
        return {ramo.ramo_id for ramo in self.ramos}


class ActualizarConfiguracionRequest(BaseModel):
    ramos: Annotated[list[RamoHabilitado], AfterValidator(_ramos_unicos)]
    actualizado_por: Texto


class CoberturaConfiguracionResponse(BaseModel):
    id: str
    nombre: str
    habilitada: bool


class RamoConfiguracionResponse(BaseModel):
    id: str
    nombre: str
    habilitado: bool
    coberturas: list[CoberturaConfiguracionResponse]


class ConfiguracionResponse(BaseModel):
    """Los ramos del canal con su estado para el socio, en el orden del portal."""

    socio_id: str
    ramos: list[RamoConfiguracionResponse]
    actualizado_en: datetime | None
    actualizado_por: str | None


class RamoFueraDelCanal(ValueError):
    pass


class CoberturaFueraDelRamo(ValueError):
    pass


class RamoNoHabilitado(PermissionError):
    pass
