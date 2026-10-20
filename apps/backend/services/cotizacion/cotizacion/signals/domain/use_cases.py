"""Resuelve el score de riesgo sin romper el presupuesto del flujo (ASR-03, ASR-10)."""

import logging
import time
from collections.abc import Callable
from decimal import Decimal

from cotizacion.signals.domain.models import NEUTRAL_RISK_SCORE, AppliedSignal, OpenFinanceConsent, SignalOrigin
from cotizacion.signals.domain.ports import RiskProfileProvider, SignalCache

logger = logging.getLogger(__name__)


class ResolveRiskProfileUseCase:
    """Proveedor si responde a tiempo; si no, el último valor bueno; si no hay, el valor neutral."""

    def __init__(
        self,
        provider: RiskProfileProvider,
        cache: SignalCache,
        ttl_s: int,
        clock: Callable[[], float] = time.perf_counter,
    ) -> None:
        self.provider = provider
        self.cache = cache
        self.ttl_s = ttl_s
        self.clock = clock

    def execute(self, consent: OpenFinanceConsent) -> AppliedSignal:
        key = f"perfil:{self.provider.source}:{consent.referencia_cliente}:{consent.consentimiento_id}"
        start = self.clock()
        try:
            score = self.provider.risk_score(consent)
        except Exception as exc:
            logger.warning("Señal %s degradada: %s", self.provider.source, type(exc).__name__)
            score, origin = self._fallback(key)
        else:
            origin = SignalOrigin.PROVIDER
            self._remember(key, score)
        return AppliedSignal(
            fuente=self.provider.source,
            origen=origin,
            score_riesgo=score,
            latencia_ms=round((self.clock() - start) * 1000),
        )

    def _fallback(self, key: str) -> tuple[Decimal, SignalOrigin]:
        try:
            cached = self.cache.get(key)
        except Exception:
            cached = None
        if cached is None:
            return NEUTRAL_RISK_SCORE, SignalOrigin.DEFAULT
        return Decimal(str(cached)), SignalOrigin.CACHE

    def _remember(self, key: str, score: Decimal) -> None:
        try:
            self.cache.set(key, str(score), self.ttl_s)
        except Exception:
            logger.warning("No se pudo guardar el último valor bueno de %s", self.provider.source)
