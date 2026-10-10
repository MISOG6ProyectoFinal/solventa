"""Modelos de la oferta de cotización de negocio (resultado post-consenso)."""

from datetime import date
from decimal import Decimal
from uuid import uuid4

from pydantic import BaseModel, Field


class CoberturaOferta(BaseModel):
    id: str
    nombre: str


class VigenciaPropuesta(BaseModel):
    desde: date
    hasta: date


class OfertaCotizacion(BaseModel):
    """Oferta final hacia el canal Mobile; no es el resultado interno de una réplica."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    producto_id: str
    prima: Decimal
    coberturas: list[CoberturaOferta] = Field(default_factory=list)
    vigencia_propuesta: VigenciaPropuesta
    version_reglas: str
