"""Puerto hacia la pasarela.

La implementación real delega en PasarelaPagosAdapter (un intento, sin reintentos).
PasarelaSimulada existe solo para desarrollo, prototipo y tests: solo aprueba el
alias demo-4242. No es una regla de negocio productiva.
"""

from solventa_common.integration import PasarelaPagosAdapter

from pagos.cobros.domain.ports import PasarelaNoDisponible
from pagos.config import settings

TOKEN_APROBADO = "demo-4242"
TOKEN_RECHAZADO = "demo-rechazo"

_APROBADO = {"approved", "aprobado", "succeeded", "success"}
_RECHAZADO = {"rejected", "rechazado", "declined", "failed"}


class PasarelaPagosGateway:
    """Adapta el contrato ya existente de PasarelaPagosAdapter. Un solo charge."""

    def __init__(self, adapter: PasarelaPagosAdapter) -> None:
        self.adapter = adapter

    def charge(self, amount: float, currency: str, token: str, idempotency_key: str) -> dict:
        try:
            raw = self.adapter.charge(amount, currency, token, idempotency_key)
        except Exception as exc:
            raise PasarelaNoDisponible("Pasarela de pagos no disponible") from exc
        if not isinstance(raw, dict):
            raise PasarelaNoDisponible("La pasarela no devolvió un resultado reconocible")
        marca = str(raw.get("estado", raw.get("status", ""))).lower()
        if marca in _APROBADO:
            return {"estado": "aprobado"}
        if marca in _RECHAZADO:
            return {"estado": "rechazado"}
        raise PasarelaNoDisponible("La pasarela no devolvió un resultado reconocible")


class PasarelaSimulada:
    """Simulador de prototipo. No llama a un proveedor ni reintenta."""

    def __init__(self) -> None:
        self.llamadas = 0

    def charge(self, amount: float, currency: str, token: str, idempotency_key: str) -> dict:
        del amount, currency
        self.llamadas += 1
        estado = "aprobado" if token == TOKEN_APROBADO else "rechazado"
        return {"estado": estado, "referencia": idempotency_key}


def construir_pasarela() -> PasarelaPagosGateway | PasarelaSimulada:
    if settings.pasarela_url:
        return PasarelaPagosGateway(PasarelaPagosAdapter(settings.pasarela_url, settings.pasarela_api_key))
    return PasarelaSimulada()
