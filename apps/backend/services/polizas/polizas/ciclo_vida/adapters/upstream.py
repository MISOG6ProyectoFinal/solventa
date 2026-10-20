"""Lecturas a Cotización y Pagos. Un 404 es "no existe"; cualquier otra falla sube como indisponibilidad."""

import httpx
from solventa_common.integration import ServiceClient


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
