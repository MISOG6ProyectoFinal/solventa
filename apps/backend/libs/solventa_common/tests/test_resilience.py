import httpx
import pytest
from solventa_common.integration import ServiceClient
from solventa_common.resilience import (
    CircuitBreaker,
    CircuitOpenError,
    CircuitState,
    InMemoryCache,
    call_with_fallback,
)


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def boom():
    raise TimeoutError("proveedor lento")


def test_circuit_opens_after_threshold_and_half_opens_after_timeout():
    clock = FakeClock()
    breaker = CircuitBreaker("x", failure_threshold=2, reset_timeout_s=10, clock=clock)
    for _ in range(2):
        with pytest.raises(TimeoutError):
            breaker.call(boom)
    assert breaker.state is CircuitState.OPEN
    with pytest.raises(CircuitOpenError):
        breaker.call(lambda: 1)

    clock.now = 10
    assert breaker.state is CircuitState.HALF_OPEN
    assert breaker.call(lambda: "ok") == "ok"
    assert breaker.state is CircuitState.CLOSED


def test_half_open_failure_reopens():
    clock = FakeClock()
    breaker = CircuitBreaker("x", failure_threshold=1, reset_timeout_s=5, clock=clock)
    with pytest.raises(TimeoutError):
        breaker.call(boom)
    clock.now = 5
    with pytest.raises(TimeoutError):
        breaker.call(boom)
    assert breaker.state is CircuitState.OPEN


def _http_error(status: int):
    def fn():
        request = httpx.Request("POST", "https://cotizacion.test/x")
        raise httpx.HTTPStatusError(str(status), request=request, response=httpx.Response(status, request=request))

    return fn


@pytest.mark.parametrize("status", [400, 401, 403, 404, 409, 422])
def test_caller_errors_do_not_open_the_circuit(status):
    breaker = CircuitBreaker("x", failure_threshold=2)
    for _ in range(5):
        with pytest.raises(httpx.HTTPStatusError):
            breaker.call(_http_error(status))
    assert breaker.state is CircuitState.CLOSED


@pytest.mark.parametrize("status", [408, 429, 500, 503])
def test_slow_saturated_or_down_target_opens_the_circuit(status):
    breaker = CircuitBreaker("x", failure_threshold=2)
    for _ in range(2):
        with pytest.raises(httpx.HTTPStatusError):
            breaker.call(_http_error(status))
    assert breaker.state is CircuitState.OPEN


def test_4xx_in_half_open_closes_the_circuit_because_the_target_answered():
    clock = FakeClock()
    breaker = CircuitBreaker("x", failure_threshold=1, reset_timeout_s=5, clock=clock)
    with pytest.raises(TimeoutError):
        breaker.call(boom)
    clock.now = 5
    with pytest.raises(httpx.HTTPStatusError):
        breaker.call(_http_error(422))
    assert breaker.state is CircuitState.CLOSED


def test_partner_validation_errors_do_not_cut_quotes_for_other_channels():
    statuses = iter([422] * 6 + [200])

    def handler(request):
        status = next(statuses)
        return httpx.Response(status, json={"prima": "1"} if status == 200 else {"detail": "datos_invalidos"})

    client = ServiceClient("cotizacion", "https://cotizacion.test")
    client.client = httpx.Client(base_url="https://cotizacion.test", transport=httpx.MockTransport(handler))
    for _ in range(6):
        with pytest.raises(httpx.HTTPStatusError):
            client.post("/consenso/cotizaciones", json={})

    assert client.post("/consenso/cotizaciones", json={}) == {"prima": "1"}


def test_fallback_serves_last_known_good():
    breaker = CircuitBreaker("x", failure_threshold=1)
    cache = InMemoryCache()
    assert call_with_fallback(breaker, cache, "k", lambda: {"prima": 10}) == ({"prima": 10}, False)
    assert call_with_fallback(breaker, cache, "k", boom) == ({"prima": 10}, True)


def test_fallback_without_cached_value_raises():
    with pytest.raises(TimeoutError):
        call_with_fallback(CircuitBreaker("x"), InMemoryCache(), "k", boom)


def test_memory_cache_returns_value_before_expiry():
    clock = FakeClock()
    cache = InMemoryCache(clock)
    cache.set("k", {"prima": 10}, ttl_s=10)
    clock.now = 9.9
    assert cache.get("k") == {"prima": 10}


def test_memory_cache_drops_expired_value():
    clock = FakeClock()
    cache = InMemoryCache(clock)
    cache.set("k", {"prima": 10}, ttl_s=10)
    clock.now = 10
    assert cache.get("k") is None


def test_fallback_uses_valid_cached_value():
    clock = FakeClock()
    cache = InMemoryCache(clock)
    breaker = CircuitBreaker("x", failure_threshold=1)
    assert call_with_fallback(breaker, cache, "k", lambda: {"prima": 10}, ttl_s=10) == ({"prima": 10}, False)
    clock.now = 9.9
    assert call_with_fallback(breaker, cache, "k", boom, ttl_s=10) == ({"prima": 10}, True)


def test_fallback_does_not_use_expired_value():
    clock = FakeClock()
    cache = InMemoryCache(clock)
    breaker = CircuitBreaker("x", failure_threshold=1)
    assert call_with_fallback(breaker, cache, "k", lambda: {"prima": 10}, ttl_s=10) == ({"prima": 10}, False)
    clock.now = 10
    with pytest.raises(TimeoutError):
        call_with_fallback(breaker, cache, "k", boom, ttl_s=10)
