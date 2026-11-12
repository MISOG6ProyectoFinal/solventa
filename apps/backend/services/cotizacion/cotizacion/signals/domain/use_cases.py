"""Resuelve el score de riesgo sin romper el presupuesto del flujo (ASR-03, ASR-10)."""

import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from cotizacion.signals.domain.models import (
    NEUTRAL_RISK_SCORE,
    AppliedSignal,
    DegradationReason,
    OpenFinanceConsent,
    SignalOrigin,
)
from cotizacion.signals.domain.ports import ProviderFailure, RiskProfileProvider, SignalCache

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(UTC)


class ResolveRiskProfileUseCase:
    """Un valor reciente de la caché sin llamar al proveedor; si no, el proveedor; si falla, el último valor bueno;
    si no hay, el valor neutral."""

    def __init__(
        self,
        provider: RiskProfileProvider,
        cache: SignalCache,
        ttl_s: int,
        clock: Callable[[], float] = time.perf_counter,
        now: Callable[[], datetime] = _utc_now,
        fresh_s: int = 0,
    ) -> None:
        self.provider = provider
        self.cache = cache
        self.ttl_s = ttl_s
        self.fresh = timedelta(seconds=fresh_s)
        self.clock = clock
        self.now = now

    def execute(self, consent: OpenFinanceConsent) -> AppliedSignal:
        key = f"perfil:{self.provider.source}:{consent.referencia_cliente}:{consent.consentimiento_id}"
        start = self.clock()
        recent = self._recent(key)
        if recent is not None:
            score, obtained_at = recent
            return AppliedSignal(
                fuente=self.provider.source,
                origen=SignalOrigin.CACHE,
                score_riesgo=score,
                latencia_ms=round((self.clock() - start) * 1000),
                obtenido_en=obtained_at,
            )
        reason: DegradationReason | None = None
        try:
            score = self.provider.risk_score(consent)
        except ProviderFailure as exc:
            reason = exc.reason
        except Exception:
            reason = DegradationReason.PROVIDER_ERROR
        if reason is None:
            origin, obtained_at = SignalOrigin.PROVIDER, self.now()
            self._remember(key, score, obtained_at)
        else:
            logger.warning("Señal %s degradada: %s", self.provider.source, reason.value)
            score, origin, obtained_at = self._fallback(key)
        return AppliedSignal(
            fuente=self.provider.source,
            origen=origin,
            score_riesgo=score,
            latencia_ms=round((self.clock() - start) * 1000),
            motivo=reason,
            obtenido_en=obtained_at,
        )

    def _recent(self, key: str) -> tuple[Decimal, datetime] | None:
        if not self.fresh:
            return None
        try:
            cached = self.cache.get(key)
        except Exception:
            return None
        if not isinstance(cached, dict) or not cached.get("obtenido_en"):
            return None
        obtained_at = datetime.fromisoformat(cached["obtenido_en"])
        if self.now() - obtained_at > self.fresh:
            return None
        return Decimal(str(cached["score_riesgo"])), obtained_at

    def _fallback(self, key: str) -> tuple[Decimal, SignalOrigin, datetime | None]:
        try:
            cached = self.cache.get(key)
        except Exception:
            cached = None
        if cached is None:
            return NEUTRAL_RISK_SCORE, SignalOrigin.DEFAULT, None
        if isinstance(cached, dict):
            obtained_at = cached.get("obtenido_en")
            return (
                Decimal(str(cached["score_riesgo"])),
                SignalOrigin.CACHE,
                datetime.fromisoformat(obtained_at) if obtained_at else None,
            )
        return Decimal(str(cached)), SignalOrigin.CACHE, None

    def _remember(self, key: str, score: Decimal, obtained_at: datetime) -> None:
        try:
            self.cache.set(key, {"score_riesgo": str(score), "obtenido_en": obtained_at.isoformat()}, self.ttl_s)
        except Exception:
            logger.warning("No se pudo guardar el último valor bueno de %s", self.provider.source)
