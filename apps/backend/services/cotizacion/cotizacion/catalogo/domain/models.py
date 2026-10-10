"""Modelos de dominio del Catálogo de Productos."""

from enum import StrEnum

from pydantic import BaseModel, Field


class Canal(StrEnum):
    """Canal comercial que origina la cotización. No interviene en el cálculo de la prima."""

    MOBILE = "mobile"
    WEB = "web"
    SOCIOS = "socios"


class Ramo(BaseModel):
    id: str
    nombre: str


class Cobertura(BaseModel):
    id: str
    nombre: str
    producto_id: str


class Producto(BaseModel):
    id: str
    nombre: str
    ramo_id: str
    activo: bool = True
    disponible_mobile: bool = False


class CoberturaResponse(BaseModel):
    id: str
    nombre: str


class RamoResponse(BaseModel):
    id: str
    nombre: str


class ProductoMobileResponse(BaseModel):
    id: str
    nombre: str
    ramo: RamoResponse
    coberturas: list[CoberturaResponse] = Field(default_factory=list)


class ProductoNoEncontrado(LookupError):
    pass


class ProductoNoDisponibleMobile(ValueError):
    pass


class ProductoInactivo(ValueError):
    pass
