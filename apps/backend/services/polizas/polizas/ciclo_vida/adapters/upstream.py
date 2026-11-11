"""Lecturas a Cotización y Pagos. Un 404 es "no existe"; cualquier otra falla sube como indisponibilidad."""

import httpx
from solventa_common.integration import ServiceClient
from solventa_common.resilience import CircuitOpenError

from polizas.ciclo_vida.domain.models import Policy
from polizas.ciclo_vida.domain.ports import RefundUnavailable


class _ServiceReader:
    def __init__(self, client: ServiceClient, path: str) -> None:
        self.client = client
        self.path = path

    def get(self, resource_id: str) -> dict | None:
        try:
            return self.client.get(self.path.format(id=resource_id))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return None
            raise


class QuoteReader(_ServiceReader):
    def __init__(self, client: ServiceClient) -> None:
        super().__init__(client, "/consenso/cotizaciones/{id}")


class PaymentReader(_ServiceReader):
    def __init__(self, client: ServiceClient) -> None:
        super().__init__(client, "/pagos/cobros/{id}")


class RefundCalculatorClient:
    """Llamada síncrona a Cotización y Rating, dueña de la regla de prima no devengada."""

    def __init__(self, client: ServiceClient) -> None:
        self.client = client

    def calculate(self, policy: Policy, cancellation_date, refundable: bool) -> dict:
        body = {
            "prima": str(policy.prima),
            "fecha_inicio": policy.vigencia.desde.isoformat(),
            "fecha_fin": policy.vigencia.hasta.isoformat(),
            "fecha_cancelacion": cancellation_date.isoformat(),
            "reembolsable": refundable,
        }
        try:
            return self.client.post("/cotizaciones/devolucion", json=body)
        except (CircuitOpenError, httpx.HTTPError) as exc:  # incluye circuito abierto y fallas de red/http
            raise RefundUnavailable(str(exc)) from exc
