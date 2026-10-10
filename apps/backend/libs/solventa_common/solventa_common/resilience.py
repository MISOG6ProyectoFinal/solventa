"""Circuit Breaker Global y Cache-Aside last-known-good.

Cada adaptador externo queda envuelto en un CircuitBreaker con timeout duro. Si el
circuito está abierto o la llamada falla, se sirve el último valor bueno de la caché.
"""

import json
import threading
import time
from collections.abc import Callable
from enum import StrEnum
from typing import Any, Protocol, TypeVar

T = TypeVar("T")


class CircuitOpenError(RuntimeError):
    pass


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        reset_timeout_s: float = 30.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout_s = reset_timeout_s
        self._clock = clock
        self._failures = 0
        self._opened_at: float | None = None
        self._lock = threading.Lock()

    @property
    def state(self) -> CircuitState:
        if self._opened_at is None:
            return CircuitState.CLOSED
        if self._clock() - self._opened_at >= self.reset_timeout_s:
            return CircuitState.HALF_OPEN
        return CircuitState.OPEN

    def call(self, fn: Callable[[], T]) -> T:
        if self.state is CircuitState.OPEN:
            raise CircuitOpenError(self.name)
        try:
            result = fn()
        except Exception:
            self._record_failure()
            raise
        self._record_success()
        return result

    def _record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            # En half-open un solo fallo vuelve a abrir el circuito.
            if self._failures >= self.failure_threshold or self._opened_at is not None:
                self._opened_at = self._clock()

    def _record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = None


class KeyValueCache(Protocol):
    def get(self, key: str) -> Any | None: ...
    def set(self, key: str, value: Any, ttl_s: int) -> None: ...


class InMemoryCache:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._data: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        item = self._data.get(key)
        if item is None:
            return None
        value, expires_at = item
        if self._clock() >= expires_at:
            del self._data[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl_s: int) -> None:
        self._data[key] = (value, self._clock() + ttl_s)


class RedisCache:
    def __init__(self, url: str) -> None:
        import redis

        self.client = redis.Redis.from_url(url, socket_timeout=0.05)

    def get(self, key: str) -> Any | None:
        raw = self.client.get(key)
        return None if raw is None else json.loads(raw)

    def set(self, key: str, value: Any, ttl_s: int) -> None:
        self.client.set(key, json.dumps(value, default=str), ex=ttl_s)


def call_with_fallback(
    breaker: CircuitBreaker,
    cache: KeyValueCache,
    cache_key: str,
    fn: Callable[[], T],
    ttl_s: int = 3600,
) -> tuple[T, bool]:
    """Devuelve (valor, es_fallback). Lanza la excepción original si no hay last-known-good."""
    try:
        value = breaker.call(fn)
    except Exception:
        cached = cache.get(cache_key)
        if cached is None:
            raise
        return cached, True
    cache.set(cache_key, value, ttl_s)
    return value, False
