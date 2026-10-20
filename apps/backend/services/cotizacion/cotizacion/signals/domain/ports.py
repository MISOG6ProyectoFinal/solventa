from decimal import Decimal
from typing import Any, Protocol

from cotizacion.signals.domain.models import OpenFinanceConsent


class RiskProfileProvider(Protocol):
    source: str

    def risk_score(self, consent: OpenFinanceConsent) -> Decimal: ...


class SignalCache(Protocol):
    def get(self, key: str) -> Any | None: ...

    def set(self, key: str, value: Any, ttl_s: int) -> None: ...
