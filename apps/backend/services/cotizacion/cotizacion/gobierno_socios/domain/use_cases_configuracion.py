from collections.abc import Callable
from datetime import UTC, datetime

from cotizacion.catalogo.domain.catalogo_socios import RAMOS_CANAL_SOCIOS
from cotizacion.catalogo.domain.models import Cobertura, Producto, Ramo
from cotizacion.catalogo.domain.ports import CatalogoRepository
from cotizacion.consenso.domain.models import CoberturaOferta
from cotizacion.gobierno_socios.domain.configuracion import (
    CoberturaConfiguracionResponse,
    CoberturaFueraDelRamo,
    ConfiguracionResponse,
    ConfiguracionSocio,
    RamoConfiguracionResponse,
    RamoFueraDelCanal,
    RamoHabilitado,
    RamoNoHabilitado,
)
from cotizacion.gobierno_socios.domain.embedded_quote import QuotableProduct, published_contract
from cotizacion.gobierno_socios.domain.models import RamoResumen, Socio, SocioNoEncontrado
from cotizacion.gobierno_socios.domain.ports import ConfiguracionRepository, SocioRepository


def _ahora() -> datetime:
    return datetime.now(UTC)


class CatalogoCanalSocios:
    """Ramos del canal embebido con las coberturas de sus productos."""

    def __init__(self, catalogo: CatalogoRepository) -> None:
        self.catalogo = catalogo

    def ramos(self) -> list[tuple[Ramo, list[Cobertura]]]:
        ramos = {ramo.id: ramo for ramo in self.catalogo.list_ramos()}
        productos = self.catalogo.list_productos()
        coberturas = self.catalogo.list_coberturas()
        resultado = []
        for ramo_id in RAMOS_CANAL_SOCIOS:
            if ramo_id not in ramos:
                continue
            del_ramo = {p.id for p in productos if p.ramo_id == ramo_id}
            resultado.append((ramos[ramo_id], [c for c in coberturas if c.producto_id in del_ramo]))
        return resultado


class ConsultarConfiguracionUseCase:
    def __init__(
        self,
        socios: SocioRepository,
        configuraciones: ConfiguracionRepository,
        catalogo: CatalogoRepository,
    ) -> None:
        self.socios = socios
        self.configuraciones = configuraciones
        self.canal = CatalogoCanalSocios(catalogo)

    def execute(self, socio_id: str) -> ConfiguracionResponse:
        if self.socios.get(socio_id) is None:
            raise SocioNoEncontrado(socio_id)
        configuracion = self.configuraciones.get(socio_id) or ConfiguracionSocio(socio_id=socio_id)
        return self.presentar(configuracion)

    def presentar(self, configuracion: ConfiguracionSocio) -> ConfiguracionResponse:
        habilitadas = {ramo.ramo_id: set(ramo.coberturas) for ramo in configuracion.ramos}
        ramos = [
            RamoConfiguracionResponse(
                id=ramo.id,
                nombre=ramo.nombre,
                habilitado=ramo.id in habilitadas,
                coberturas=[
                    CoberturaConfiguracionResponse(
                        id=c.id, nombre=c.nombre, habilitada=c.id in habilitadas.get(ramo.id, set())
                    )
                    for c in coberturas
                ],
            )
            for ramo, coberturas in self.canal.ramos()
        ]
        return ConfiguracionResponse(
            socio_id=configuracion.socio_id,
            ramos=ramos,
            actualizado_en=configuracion.actualizado_en,
            actualizado_por=configuracion.actualizado_por,
        )


class ActualizarConfiguracionUseCase:
    """Reemplaza la configuración del socio. Aplica desde la siguiente llamada, sin redesplegar."""

    def __init__(
        self,
        socios: SocioRepository,
        configuraciones: ConfiguracionRepository,
        catalogo: CatalogoRepository,
        ahora: Callable[[], datetime] = _ahora,
    ) -> None:
        self.socios = socios
        self.configuraciones = configuraciones
        self.canal = CatalogoCanalSocios(catalogo)
        self.ahora = ahora

    def execute(self, socio_id: str, ramos: list[RamoHabilitado], usuario: str) -> ConfiguracionSocio:
        if self.socios.get(socio_id) is None:
            raise SocioNoEncontrado(socio_id)
        permitidas = {ramo.id: {c.id for c in coberturas} for ramo, coberturas in self.canal.ramos()}
        for ramo in ramos:
            if ramo.ramo_id not in permitidas:
                raise RamoFueraDelCanal(ramo.ramo_id)
            ajenas = set(ramo.coberturas) - permitidas[ramo.ramo_id]
            if ajenas:
                raise CoberturaFueraDelRamo(sorted(ajenas)[0])
        configuracion = ConfiguracionSocio(
            socio_id=socio_id, ramos=ramos, actualizado_en=self.ahora(), actualizado_por=usuario
        )
        self.configuraciones.save(configuracion)
        return configuracion


class AutorizarRamoUseCase:
    """Rechaza la operación del socio si el ramo del producto no está en su configuración."""

    def __init__(self, configuraciones: ConfiguracionRepository) -> None:
        self.configuraciones = configuraciones

    def execute(self, socio: Socio, producto: Producto) -> RamoHabilitado:
        """Devuelve el ramo con las coberturas que el socio puede vender."""
        configuracion = self.configuraciones.get(socio.id)
        enabled = (
            next((r for r in configuracion.ramos if r.ramo_id == producto.ramo_id), None) if configuracion else None
        )
        if enabled is None:
            raise RamoNoHabilitado(producto.ramo_id)
        return enabled


class PartnerCatalogUseCase:
    """Productos que el socio puede cotizar con sus coberturas habilitadas y su contrato."""

    def __init__(self, configurations: ConfiguracionRepository, catalog: CatalogoRepository) -> None:
        self.configurations = configurations
        self.catalog = catalog

    def execute(self, socio: Socio) -> list[QuotableProduct]:
        configuration = self.configurations.get(socio.id)
        if configuration is None:
            return []
        names = {ramo.id: ramo.nombre for ramo in self.catalog.list_ramos()}
        enabled_lines = sorted(configuration.ramos, key=lambda line: RAMOS_CANAL_SOCIOS.index(line.ramo_id))
        products = self.catalog.list_productos()
        result = []
        for line in enabled_lines:
            for product in (p for p in products if p.ramo_id == line.ramo_id and p.activo):
                contract = published_contract(product.id)
                if contract is None:
                    continue
                coverages = [
                    CoberturaOferta(id=c.id, nombre=c.nombre)
                    for c in self.catalog.list_coberturas(product.id)
                    if c.id in line.coberturas
                ]
                result.append(
                    QuotableProduct(
                        producto_id=product.id,
                        nombre=product.nombre,
                        ramo=RamoResumen(id=line.ramo_id, nombre=names.get(line.ramo_id, line.ramo_id)),
                        coberturas=coverages,
                        contrato=contract,
                    )
                )
        return result
