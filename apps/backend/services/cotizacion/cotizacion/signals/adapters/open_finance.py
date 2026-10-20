"""Perfil financiero desde Open Finance, con el timeout duro del flujo de cotización.

Sin OPEN_FINANCE_URL no hay proveedor real: responde el simulador de sandbox (RT-02).
"""

import hashlib
from decimal import Decimal, InvalidOperation

from solventa_common.integration import OpenFinanceAdapter

from cotizacion.signals.domain.models import OpenFinanceConsent

SOURCE = "open-finance"


def _valid_score(value: object) -> Decimal:
    try:
        score = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("Open Finance devolvió un score no numérico") from exc
    if not Decimal(0) <= score <= Decimal(1):
        raise ValueError("Open Finance devolvió un score fuera de rango")
    return score


class OpenFinanceQuoteAdapter(OpenFinanceAdapter):
    """Un solo intento: un reintento duplicaría el presupuesto de 300 ms."""

    retries = 0

    def __init__(self, base_url: str, api_key: str | None, timeout_s: float) -> None:
        self.timeout_s = timeout_s
        super().__init__(base_url, api_key)


class OpenFinanceRiskProfile:
    source = SOURCE

    def __init__(self, adapter: OpenFinanceAdapter) -> None:
        self.adapter = adapter

    def risk_score(self, consent: OpenFinanceConsent) -> Decimal:
        profile = self.adapter.get_financial_profile(consent.referencia_cliente, consent.consentimiento_id)
        if not isinstance(profile, dict) or "score_riesgo" not in profile:
            raise ValueError("Open Finance no devolvió score_riesgo")
        return _valid_score(profile["score_riesgo"])


class SandboxRiskProfile:
    """Sandbox determinista: el mismo cliente siempre recibe el mismo score entre 0.30 y 0.70."""

    source = SOURCE

    def risk_score(self, consent: OpenFinanceConsent) -> Decimal:
        digest = hashlib.sha256(consent.referencia_cliente.encode()).digest()
        return Decimal(30 + digest[0] % 41) / Decimal(100)


def build_provider(
    url: str | None, api_key: str | None, timeout_s: float
) -> OpenFinanceRiskProfile | SandboxRiskProfile:
    if url:
        return OpenFinanceRiskProfile(OpenFinanceQuoteAdapter(url, api_key, timeout_s))
    return SandboxRiskProfile()
