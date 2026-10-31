"""Perfil financiero desde Open Finance, con el timeout duro del flujo de cotización.

Sin OPEN_FINANCE_URL no hay proveedor real: responde el simulador de sandbox (RT-02).
"""

import hashlib
from decimal import Decimal, InvalidOperation

import httpx
from solventa_common.integration import OpenFinanceAdapter
from solventa_common.resilience import CircuitBreaker, CircuitOpenError

from cotizacion.signals.domain.models import DegradationReason, OpenFinanceConsent
from cotizacion.signals.domain.ports import ProviderFailure

SOURCE = "open-finance"


def _valid_score(value: object) -> Decimal:
    try:
        score = Decimal(str(value))
    except InvalidOperation as exc:
        raise ProviderFailure(DegradationReason.INVALID_RESPONSE) from exc
    if not Decimal(0) <= score <= Decimal(1):
        raise ProviderFailure(DegradationReason.INVALID_RESPONSE)
    return score


class OpenFinanceQuoteAdapter(OpenFinanceAdapter):
    """Un solo intento: un reintento duplicaría el presupuesto de 300 ms."""

    retries = 0

    def __init__(
        self, base_url: str, api_key: str | None, timeout_s: float, breaker: CircuitBreaker | None = None
    ) -> None:
        self.timeout_s = timeout_s
        super().__init__(base_url, api_key, breaker)


class OpenFinanceRiskProfile:
    source = SOURCE

    def __init__(self, adapter: OpenFinanceAdapter) -> None:
        self.adapter = adapter

    def risk_score(self, consent: OpenFinanceConsent) -> Decimal:
        try:
            profile = self.adapter.get_financial_profile(consent.referencia_cliente, consent.consentimiento_id)
        except CircuitOpenError as exc:
            raise ProviderFailure(DegradationReason.CIRCUIT_OPEN) from exc
        except httpx.TimeoutException as exc:
            raise ProviderFailure(DegradationReason.TIMEOUT) from exc
        except ValueError as exc:
            raise ProviderFailure(DegradationReason.INVALID_RESPONSE) from exc
        except httpx.HTTPError as exc:
            raise ProviderFailure(DegradationReason.PROVIDER_ERROR) from exc
        if not isinstance(profile, dict) or "score_riesgo" not in profile:
            raise ProviderFailure(DegradationReason.INVALID_RESPONSE)
        return _valid_score(profile["score_riesgo"])


class SandboxRiskProfile:
    """Sandbox determinista: el mismo cliente siempre recibe el mismo score entre 0.30 y 0.70."""

    source = SOURCE

    def risk_score(self, consent: OpenFinanceConsent) -> Decimal:
        digest = hashlib.sha256(consent.referencia_cliente.encode()).digest()
        return Decimal(30 + digest[0] % 41) / Decimal(100)


def build_provider(
    url: str | None, api_key: str | None, timeout_s: float, breaker: CircuitBreaker | None = None
) -> OpenFinanceRiskProfile | SandboxRiskProfile:
    if url:
        return OpenFinanceRiskProfile(OpenFinanceQuoteAdapter(url, api_key, timeout_s, breaker))
    return SandboxRiskProfile()
