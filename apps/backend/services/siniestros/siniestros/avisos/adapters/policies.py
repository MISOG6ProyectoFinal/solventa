"""Pólizas vistas desde Siniestros: solo lo necesario para validar un aviso."""

from urllib.parse import quote

import httpx
from solventa_common.integration import ServiceClient


class PolizasDirectory:
    def __init__(self, client: ServiceClient) -> None:
        self.client = client

    def get(self, poliza_id: str) -> dict | None:
        try:
            return self.client.get(f"/polizas/{quote(poliza_id, safe='')}")
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == httpx.codes.NOT_FOUND:
                return None
            raise
