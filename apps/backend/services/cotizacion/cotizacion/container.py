"""Composición de dependencias del servicio de cotización."""

from collections.abc import Awaitable, Callable

from pydantic import TypeAdapter
from solventa_common.resilience import InMemoryCache, KeyValueCache, RedisCache
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
from cotizacion.gobierno_socios.adapters.configuracion_repository import (
    InMemoryConfiguracionRepository,
    PostgresConfiguracionRepository,
)
from cotizacion.gobierno_socios.adapters.repository import InMemorySocioRepository, PostgresSocioRepository
from cotizacion.gobierno_socios.domain.use_cases import (
    AutorizarSocioUseCase,
    ConsultarSociosUseCase,
    DarDeAltaSocioUseCase,
)
from cotizacion.gobierno_socios.domain.use_cases_configuracion import (
    ActualizarConfiguracionUseCase,
    AutorizarRamoUseCase,
    ConsultarConfiguracionUseCase,
)
from cotizacion.rating.domain.models import SolicitudRating
from cotizacion.rating.domain.rating import REGLAS_VIGENTES
from cotizacion.rating.domain.use_cases import CotizarUseCase
from cotizacion.senales.adapters.open_finance import construir_proveedor
from cotizacion.senales.domain.use_cases import ResolverScoreRiesgoUseCase


async def _fanout_produccion(body: dict) -> list[dict]:
    try:
        ips = resolver_replicas(settings.cotizacion_replicas_host, settings.puerto_replicas)
    except Exception:
        ips = []
    if not ips:
        return await fanout_local(body)
    ips = ips[: settings.replicas_esperadas]
    respuestas = await cotizar_en_replicas(ips, settings.puerto_replicas, body, settings.consenso_timeout_s)
    if respuestas:
        return respuestas
    return await fanout_local(body)


_solicitud_rating = TypeAdapter(SolicitudRating)


async def fanout_local(body: dict) -> list[dict]:
    """Simula tres réplicas locales (tests / entorno sin DNS headless)."""
    uc = CotizarUseCase(REGLAS_VIGENTES, instancia="local")
    resultado = uc.execute(_solicitud_rating.validate_python(body))
    payload = resultado.model_dump(mode="json")
    return [payload, payload, payload]


class Container:
    def __init__(self) -> None:
        self.catalogo = InMemoryCatalogoRepository()
        self.cotizaciones = InMemoryCotizacionRepository()
        self.socios = InMemorySocioRepository()
        self.configuraciones = InMemoryConfiguracionRepository()
        seed_catalogo(self.catalogo)
        self.cache_senales: KeyValueCache = RedisCache(settings.redis_url) if settings.redis_url else InMemoryCache()
        self.proveedor_perfil = construir_proveedor(
            settings.open_finance_url, settings.open_finance_api_key, settings.open_finance_timeout_s
        )
        self.fanout: Callable[[dict], Awaitable[list[dict]]] = _fanout_produccion
        self._wire()

    def use_postgres(self, engine: Engine) -> None:
        """Conecta los repositorios. El schema y el seed viven en el bootstrap, no aquí."""
        self.catalogo = PostgresCatalogoRepository(engine)
        self.cotizaciones = PostgresCotizacionRepository(engine)
        self.socios = PostgresSocioRepository(engine)
        self.configuraciones = PostgresConfiguracionRepository(engine)
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
        self.dar_de_alta_socio = DarDeAltaSocioUseCase(self.socios)
        self.consultar_socios = ConsultarSociosUseCase(self.socios)
        self.autorizar_socio = AutorizarSocioUseCase(self.socios)
        self.consultar_configuracion = ConsultarConfiguracionUseCase(self.socios, self.configuraciones, self.catalogo)
        self.actualizar_configuracion = ActualizarConfiguracionUseCase(self.socios, self.configuraciones, self.catalogo)
        self.autorizar_ramo = AutorizarRamoUseCase(self.configuraciones)
        self.resolver_score = ResolverScoreRiesgoUseCase(
            self.proveedor_perfil, self.cache_senales, settings.senales_cache_ttl_s
        )


container = Container()
