"""Perfil financiero desde Open Finance, con el timeout duro del flujo de cotización.

Sin OPEN_FINANCE_URL no hay proveedor real: responde el simulador de sandbox (RT-02).
"""

import hashlib
from decimal import Decimal, InvalidOperation

from solventa_common.integration import OpenFinanceAdapter

from cotizacion.senales.domain.models import ConsentimientoOpenFinance

FUENTE = "open-finance"


def _riesgo_valido(valor: object) -> Decimal:
    try:
        score = Decimal(str(valor))
    except InvalidOperation as exc:
        raise ValueError("Open Finance devolvió un score no numérico") from exc
    if not Decimal(0) <= score <= Decimal(1):
        raise ValueError("Open Finance devolvió un score fuera de rango")
    return score


class OpenFinanceCotizacionAdapter(OpenFinanceAdapter):
    """Un solo intento: un reintento duplicaría el presupuesto de 300 ms."""

    retries = 0

    def __init__(self, base_url: str, api_key: str | None, timeout_s: float) -> None:
        self.timeout_s = timeout_s
        super().__init__(base_url, api_key)


class PerfilOpenFinance:
    fuente = FUENTE

    def __init__(self, adaptador: OpenFinanceAdapter) -> None:
        self.adaptador = adaptador

    def consultar_riesgo(self, consentimiento: ConsentimientoOpenFinance) -> Decimal:
        perfil = self.adaptador.get_financial_profile(
            consentimiento.referencia_cliente, consentimiento.consentimiento_id
        )
        if not isinstance(perfil, dict) or "score_riesgo" not in perfil:
            raise ValueError("Open Finance no devolvió score_riesgo")
        return _riesgo_valido(perfil["score_riesgo"])


class PerfilOpenFinanceSimulado:
    """Sandbox determinista: el mismo cliente siempre recibe el mismo score entre 0.30 y 0.70."""

    fuente = FUENTE

    def consultar_riesgo(self, consentimiento: ConsentimientoOpenFinance) -> Decimal:
        digest = hashlib.sha256(consentimiento.referencia_cliente.encode()).digest()
        return Decimal(30 + digest[0] % 41) / Decimal(100)


def construir_proveedor(
    url: str | None, api_key: str | None, timeout_s: float
) -> PerfilOpenFinance | PerfilOpenFinanceSimulado:
    if url:
        return PerfilOpenFinance(OpenFinanceCotizacionAdapter(url, api_key, timeout_s))
    return PerfilOpenFinanceSimulado()
