"""Cliente HTTP con timeout duro, reintentos acotados y circuit breaker."""

from typing import Any

import httpx

from solventa_common.resilience import CircuitBreaker


class ExternalAdapter:
    """Base de los adaptadores a terceros (HTTPS con timeout, reintentos y circuit breaker)."""

    name = "external"
    timeout_s = 3.0  # Máximo absoluto de la sección 9.5.2; cada adaptador lo ajusta.
    retries = 1

    def __init__(self, base_url: str, api_key: str | None = None, breaker: CircuitBreaker | None = None) -> None:
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self.client = httpx.Client(base_url=base_url, timeout=self.timeout_s, headers=headers)
        self.breaker = breaker or CircuitBreaker(self.name)

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        def do() -> Any:
            last_error: Exception | None = None
            for _ in range(self.retries + 1):
                try:
                    response = self.client.request(method, path, **kwargs)
                    response.raise_for_status()
                    return response.json()
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    last_error = exc
            raise last_error  # type: ignore[misc]

        return self.breaker.call(do)


class ServiceClient(ExternalAdapter):
    """Invocación síncrona «call» entre microservicios dentro del clúster."""

    timeout_s = 1.0
    retries = 0

    def __init__(self, name: str, base_url: str) -> None:
        self.name = name
        super().__init__(base_url, breaker=CircuitBreaker(name, failure_threshold=5, reset_timeout_s=10))

    def get(self, path: str, **kwargs: Any) -> Any:
        return self._request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> Any:
        return self._request("POST", path, **kwargs)


def call_upstream(fn, *args: Any, **kwargs: Any) -> Any:
    """Traduce fallas de un servicio interno a respuestas HTTP del BFF.

    Circuito abierto o timeout → 503; error de negocio del servicio → mismo código.
    """
    from fastapi import HTTPException

    from solventa_common.resilience import CircuitOpenError

    try:
        return fn(*args, **kwargs)
    except CircuitOpenError as exc:
        raise HTTPException(status_code=503, detail=f"{exc} no disponible (circuito abierto)") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Servicio interno no disponible") from exc
