"""Puerto hacia la pasarela: delega en PasarelaPagosAdapter (un intento, sin reintentos).

PASARELA_URL apunta al proveedor. Mientras no hay acceso al real, apunta al servicio simuladores.
"""

from solventa_common.integration import PasarelaPagosAdapter

from pagos.cobros.domain.ports import PasarelaNoDisponible
from pagos.config import settings

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


def construir_pasarela() -> PasarelaPagosGateway:
    return PasarelaPagosGateway(PasarelaPagosAdapter(settings.pasarela_url, settings.pasarela_api_key))
