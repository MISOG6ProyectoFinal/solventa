"""Lo que el socio ve de cada producto que puede cotizar (HU014). El contrato es el de todos los canales."""

from pydantic import BaseModel

from cotizacion.consenso.domain.models import CoberturaOferta
from cotizacion.gobierno_socios.domain.models import RamoResumen


class QuotableProduct(BaseModel):
    """Lo que el socio puede cotizar hoy y el cuerpo que debe enviar."""

    producto_id: str
    nombre: str
    ramo: RamoResumen
    coberturas: list[CoberturaOferta]
    contrato: dict
