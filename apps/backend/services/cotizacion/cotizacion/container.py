"""Composición de dependencias del servicio de cotización."""

import asyncio
import secrets
import socket
from collections.abc import Awaitable, Callable
from datetime import timedelta

from solventa_common.resilience import CircuitBreaker, InMemoryCache, KeyValueCache, RedisCache
from sqlalchemy.engine import Engine

from cotizacion.catalogo.adapters.repository import InMemoryCatalogoRepository, PostgresCatalogoRepository
from cotizacion.catalogo.adapters.seed import seed_catalogo
from cotizacion.catalogo.domain.use_cases import (
    ListarProductosMobileUseCase,
    ListChannelLinesUseCase,
    ValidarProductoParaCanalUseCase,
)
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
from cotizacion.gobierno_socios.adapters.quota_repository import InMemoryQuotaCounter, PostgresQuotaCounter
from cotizacion.gobierno_socios.adapters.repository import InMemorySocioRepository, PostgresSocioRepository
from cotizacion.gobierno_socios.domain.credential_lifecycle import (
    CredentialEventsQuery,
    RevokeCredentialUseCase,
    RotateCredentialUseCase,
)
from cotizacion.gobierno_socios.domain.quota import ConsumeQuotaUseCase, QuotaUsageQuery, UpdateQuotaUseCase
from cotizacion.gobierno_socios.domain.use_cases import (
    AutorizarSocioUseCase,
    ConsultarSociosUseCase,
    DarDeAltaSocioUseCase,
)
from cotizacion.gobierno_socios.domain.use_cases_configuracion import (
    ActualizarConfiguracionUseCase,
    AutorizarRamoUseCase,
    ConsultarConfiguracionUseCase,
    PartnerCatalogUseCase,
)
from cotizacion.rating.adapters.repository import InMemoryRulesRepository, PostgresRulesRepository
from cotizacion.rating.adapters.seed import seed_rules
from cotizacion.rating.domain.models import parse_rating_request
from cotizacion.rating.domain.use_cases import CotizarUseCase
from cotizacion.signals.adapters.open_finance import build_provider
from cotizacion.signals.domain.use_cases import ResolveRiskProfileUseCase


class Container:
    def __init__(self) -> None:
        self.catalogo = InMemoryCatalogoRepository()
        self.rules = InMemoryRulesRepository()
        self.cotizaciones = InMemoryCotizacionRepository()
        self.socios = InMemorySocioRepository()
        self.configuraciones = InMemoryConfiguracionRepository()
        self.quota_counter = InMemoryQuotaCounter()
        seed_catalogo(self.catalogo)
        seed_rules(self.rules)
        self.signal_cache: KeyValueCache = RedisCache(settings.redis_url) if settings.redis_url else InMemoryCache()
        self.risk_profile_provider = build_provider(
            settings.open_finance_url,
            settings.open_finance_api_key,
            settings.open_finance_timeout_s,
            CircuitBreaker(
                "open-finance",
                failure_threshold=settings.open_finance_breaker_failures,
                reset_timeout_s=settings.open_finance_breaker_reset_s,
            ),
        )
        self.fanout: Callable[[dict, float], Awaitable[list[dict]]] = self._fanout_produccion
        self._wire()

    def use_postgres(self, engine: Engine) -> None:
        """Conecta los repositorios. El schema y el seed viven en el bootstrap, no aquí."""
        self.catalogo = PostgresCatalogoRepository(engine)
        self.rules = PostgresRulesRepository(engine)
        self.cotizaciones = PostgresCotizacionRepository(engine)
        self.socios = PostgresSocioRepository(engine)
        self.configuraciones = PostgresConfiguracionRepository(engine)
        self.quota_counter = PostgresQuotaCounter(engine)
        self._wire()

    def use_local_fanout(self) -> None:
        self.fanout = self._fanout_local
        self._wire()

    async def _fanout_produccion(self, body: dict, timeout_s: float) -> list[dict]:
        try:
            ips = await asyncio.to_thread(
                resolver_replicas, settings.cotizacion_replicas_host, settings.puerto_replicas
            )
        except Exception:
            ips = []
        if not ips:
            return await self._fanout_local(body, timeout_s)
        ips = secrets.SystemRandom().sample(ips, min(len(ips), settings.replicas_esperadas))
        respuestas = await cotizar_en_replicas(ips, settings.puerto_replicas, body, timeout_s, settings.quorum)
        if len(respuestas) >= settings.quorum:
            return respuestas
        return await self._fanout_local(body, timeout_s)

    async def _fanout_local(self, body: dict, _timeout_s: float = 0.0) -> list[dict]:
        """Simula tres réplicas locales (tests / entorno sin DNS headless)."""
        resultado = self.rate_quote.execute(parse_rating_request(body))
        payload = resultado.model_dump(mode="json")
        return [payload, payload, payload]

    def _wire(self) -> None:
        self.rate_quote = CotizarUseCase(self.rules, instancia=socket.gethostname())
        self.listar_lines_in_channel = ListChannelLinesUseCase(self.catalogo)
        self.listar_productos_mobile = ListarProductosMobileUseCase(self.catalogo)
        self.validar_producto_canal = ValidarProductoParaCanalUseCase(self.catalogo)
        self.cotizar_con_consenso = CotizarConConsensoUseCase(
            catalogo=self.catalogo,
            cotizaciones=self.cotizaciones,
            fanout=self.fanout,
            quorum=settings.quorum,
            fanout_timeout_s=settings.consenso_timeout_s,
        )
        self.dar_de_alta_socio = DarDeAltaSocioUseCase(self.socios)
        self.consultar_socios = ConsultarSociosUseCase(self.socios)
        self.autorizar_socio = AutorizarSocioUseCase(self.socios)
        self.consume_quota = ConsumeQuotaUseCase(self.quota_counter)
        self.quota_usage = QuotaUsageQuery(self.socios, self.quota_counter)
        self.update_quota = UpdateQuotaUseCase(self.socios)
        self.rotate_credential = RotateCredentialUseCase(
            self.socios, timedelta(minutes=settings.credential_grace_minutes)
        )
        self.revoke_credential = RevokeCredentialUseCase(self.socios)
        self.credential_events = CredentialEventsQuery(self.socios)
        self.consultar_configuracion = ConsultarConfiguracionUseCase(self.socios, self.configuraciones, self.catalogo)
        self.actualizar_configuracion = ActualizarConfiguracionUseCase(self.socios, self.configuraciones, self.catalogo)
        self.autorizar_ramo = AutorizarRamoUseCase(self.configuraciones)
        self.partner_catalog = PartnerCatalogUseCase(self.configuraciones, self.catalogo, self.rules)
        self.resolve_risk_profile = ResolveRiskProfileUseCase(
            self.risk_profile_provider,
            self.signal_cache,
            settings.signal_cache_ttl_s,
            fresh_s=settings.signal_fresh_s,
        )


container = Container()
