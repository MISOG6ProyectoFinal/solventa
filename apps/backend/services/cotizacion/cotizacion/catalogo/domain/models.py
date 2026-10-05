"""Modelos de dominio del Catálogo de Productos."""

from pydantic import BaseModel, Field


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
