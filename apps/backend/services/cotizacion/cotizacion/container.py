"""Composición de dependencias del servicio de cotización."""

from collections.abc import Awaitable, Callable

from sqlalchemy.engine import Engine

from cotizacion.catalogo.adapters.repository import InMemoryCatalogoRepository, PostgresCatalogoRepository
from cotizacion.catalogo.adapters.seed import seed_catalogo
from cotizacion.catalogo.domain.use_cases import ListarProductosMobileUseCase
from cotizacion.config import settings
from cotizacion.consenso.adapters.cotizacion_repository import (
    InMemoryCotizacionRepository,
    PostgresCotizacionRepository,
)
from cotizacion.consenso.adapters.replicas import cotizar_en_replicas, resolver_replicas
from cotizacion.consenso.domain.use_cases import CotizarConConsensoUseCase
from cotizacion.rating.domain.models import SolicitudCotizacion
from cotizacion.rating.domain.rating import REGLAS_VIGENTES
from cotizacion.rating.domain.use_cases import CotizarUseCase


async def _fanout_produccion(body: dict) -> list[dict]:
    ips = resolver_replicas(settings.cotizacion_replicas_host, settings.cotizacion_port)
    ips = ips[: settings.replicas_esperadas]
    return await cotizar_en_replicas(ips, settings.cotizacion_port, body, settings.consenso_timeout_s)


async def fanout_local(body: dict) -> list[dict]:
    """Simula tres réplicas locales (tests / entorno sin DNS headless)."""
    uc = CotizarUseCase(REGLAS_VIGENTES, instancia="local")
    resultado = uc.execute(SolicitudCotizacion.model_validate(body))
    payload = resultado.model_dump(mode="json")
    return [payload, payload, payload]


class Container:
    def __init__(self) -> None:
        self.catalogo = InMemoryCatalogoRepository()
        self.cotizaciones = InMemoryCotizacionRepository()
        seed_catalogo(self.catalogo)
        self.fanout: Callable[[dict], Awaitable[list[dict]]] = _fanout_produccion
        self._wire()

    def use_postgres(self, engine: Engine) -> None:
        """Conecta los repositorios. El schema y el seed viven en el bootstrap, no aquí."""
        self.catalogo = PostgresCatalogoRepository(engine)
        self.cotizaciones = PostgresCotizacionRepository(engine)
        self._wire()

    def use_local_fanout(self) -> None:
        self.fanout = fanout_local
        self._wire()

    def _wire(self) -> None:
        self.listar_productos_mobile = ListarProductosMobileUseCase(self.catalogo)
        self.cotizar_con_consenso = CotizarConConsensoUseCase(
            catalogo=self.catalogo,
            cotizaciones=self.cotizaciones,
            fanout=self.fanout,
            quorum=settings.quorum,
        )


container = Container()
