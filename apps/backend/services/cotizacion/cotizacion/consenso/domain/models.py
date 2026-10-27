"""Modelos de la oferta de cotización de negocio (resultado post-consenso)."""

from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from pydantic import BaseModel, Field
from solventa_common.vigencia_cotizacion import calcular_vigente_hasta

from cotizacion.rating.domain.models import DesgloseCotizacion
from cotizacion.signals.domain.models import AppliedSignal

ESTADO_COTIZACION_VIGENTE = "VIGENTE"


def generar_id_cotizacion() -> str:
    return f"COT-2026-{uuid4().hex[:4].upper()}"


class CoberturaOferta(BaseModel):
    id: str
    nombre: str


class VigenciaPropuesta(BaseModel):
    desde: date
    hasta: date


class OfertaCotizacion(BaseModel):
    """Oferta final hacia el canal; no es el resultado interno de una réplica."""

    id: str = Field(default_factory=generar_id_cotizacion)
    producto_id: str
    prima: Decimal
    coberturas: list[CoberturaOferta] = Field(default_factory=list)
    vigencia_propuesta: VigenciaPropuesta
    vigente_hasta: datetime = Field(default_factory=calcular_vigente_hasta)
    version_reglas: str
    datos_riesgo: dict = Field(default_factory=dict)
    canal: str = "web"
    cliente_id: str | None = None
    socio_id: str | None = None
    degradada: bool = False
    senales: list[AppliedSignal] = Field(default_factory=list)
    estado: str = ESTADO_COTIZACION_VIGENTE
    impuestos: Decimal = Decimal("0.00")
    desglose: DesgloseCotizacion | None = None
    consentimiento_id: str | None = None
