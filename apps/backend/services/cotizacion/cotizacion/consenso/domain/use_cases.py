"""Orquestación: validar producto → consenso → enriquecer oferta → persistir una cotización."""

from collections.abc import Awaitable, Callable
from datetime import date, timedelta
from decimal import Decimal

from cotizacion.catalogo.domain.models import Canal
from cotizacion.catalogo.domain.ports import CatalogoRepository
from cotizacion.catalogo.domain.use_cases import ValidarProductoParaCanalUseCase
from cotizacion.consenso.domain.consensus import votar
from cotizacion.consenso.domain.models import CoberturaOferta, OfertaCotizacion, VigenciaPropuesta
from cotizacion.consenso.domain.ports import CotizacionRepository
from cotizacion.rating.domain.models import SolicitudCotizacionViaje, SolicitudRating

FanoutFn = Callable[[dict], Awaitable[list[dict]]]

VIGENCIA_DIAS_DEFAULT = 365


def construir_vigencia_propuesta(hoy: date | None = None, dias: int = VIGENCIA_DIAS_DEFAULT) -> VigenciaPropuesta:
    desde = hoy or date.today()
    return VigenciaPropuesta(desde=desde, hasta=desde + timedelta(days=dias))


class CotizarConConsensoUseCase:
    def __init__(
        self,
        catalogo: CatalogoRepository,
        cotizaciones: CotizacionRepository,
        fanout: FanoutFn,
        quorum: int,
        vigencia_dias: int = VIGENCIA_DIAS_DEFAULT,
    ) -> None:
        self.validar_producto = ValidarProductoParaCanalUseCase(catalogo)
        self.catalogo = catalogo
        self.cotizaciones = cotizaciones
        self.fanout = fanout
        self.quorum = quorum
        self.vigencia_dias = vigencia_dias

    async def execute(self, solicitud: SolicitudRating, canal: Canal) -> OfertaCotizacion:
        producto = self.validar_producto.execute(solicitud.producto_id, canal)
        body = solicitud.model_dump(mode="json")
        respuestas = await self.fanout(body)
        prima_ganadora = votar([Decimal(str(r["prima"])) for r in respuestas], self.quorum)
        elegida = next(r for r in respuestas if Decimal(str(r["prima"])) == prima_ganadora)
        coberturas = [CoberturaOferta(id=c.id, nombre=c.nombre) for c in self.catalogo.list_coberturas(producto.id)]
        oferta = OfertaCotizacion(
            producto_id=producto.id,
            prima=prima_ganadora,
            coberturas=coberturas,
            vigencia_propuesta=self._vigencia_propuesta(solicitud),
            version_reglas=str(elegida["version_reglas"]),
        )
        self.cotizaciones.save(oferta)
        return oferta

    def _vigencia_propuesta(self, solicitud: SolicitudRating) -> VigenciaPropuesta:
        """En viaje la cobertura dura exactamente el viaje; el resto conserva la vigencia anual."""
        if isinstance(solicitud, SolicitudCotizacionViaje):
            return VigenciaPropuesta(desde=solicitud.fecha_salida, hasta=solicitud.fecha_regreso)
        return construir_vigencia_propuesta(dias=self.vigencia_dias)
