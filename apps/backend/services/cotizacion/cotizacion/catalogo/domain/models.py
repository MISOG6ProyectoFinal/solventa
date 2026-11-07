"""Modelos de dominio del Catálogo de Productos."""

from decimal import Decimal
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
    orden: int = 0


class Cobertura(BaseModel):
    id: str
    nombre: str
    producto_id: str


class MobilePresentation(BaseModel):
    orden: int
    descripcion: str
    precio_desde: Decimal


class Producto(BaseModel):
    id: str
    nombre: str
    ramo_id: str
    activo: bool = True
    canales: list[Canal] = Field(default_factory=list)
    requiere_consentimiento: bool = False
    presentacion_mobile: MobilePresentation | None = None


class CoberturaResponse(BaseModel):
    id: str
    nombre: str


class RamoResponse(BaseModel):
    id: str
    nombre: str


class ChannelProductResponse(BaseModel):
    id: str
    nombre: str
    requiere_consentimiento: bool


class ChannelLineResponse(BaseModel):
    id: str
    nombre: str
    requiere_consentimiento: bool
    productos: list[ChannelProductResponse]


class ProductoMobileResponse(BaseModel):
    id: str
    nombre: str
    descripcion: str
    precio_desde: Decimal
    disponible: bool
    ramo: RamoResponse
    coberturas: list[CoberturaResponse] = Field(default_factory=list)


class ProductoNoEncontrado(LookupError):
    pass


class ProductNotInChannel(ValueError):
    pass


class ProductoInactivo(ValueError):
    pass
