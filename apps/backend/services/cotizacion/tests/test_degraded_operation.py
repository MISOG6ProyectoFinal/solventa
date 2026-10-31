"""HU018: operación degradada ante fallo de un tercero."""

import json
import threading
import time
from datetime import UTC, datetime
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from cotizacion.config import CotizacionSettings
from cotizacion.container import container
from cotizacion.main import app
from cotizacion.signals.adapters.open_finance import build_provider
from cotizacion.signals.domain.models import DegradationReason, OpenFinanceConsent, SignalOrigin
from cotizacion.signals.domain.ports import ProviderFailure
from cotizacion.signals.domain.use_cases import ResolveRiskProfileUseCase
from fastapi.testclient import TestClient
from solventa_common.resilience import CircuitBreaker, InMemoryCache

client = TestClient(app)

CONSENT = OpenFinanceConsent(referencia_cliente="cliente-77", consentimiento_id="consent-1")
CACHE_KEY = "perfil:open-finance:cliente-77:consent-1"
MORTGAGE = {
    "producto_id": "vida-hipotecario",
    "fecha_nacimiento": "1986-01-01",
    "entidad": "Banco Aurora",
    "valor_credito": "250000000",
    "plazo_anios": 15,
    "consentimiento_open_finance": {"referencia_cliente": "cliente-77", "consentimiento_id": "consent-1"},
}
FIRST_READ = datetime(2026, 10, 28, 15, 30, tzinfo=UTC)


class _Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


class _FakeProvider:
    source = "open-finance"

    def __init__(self, score: str = "0.7") -> None:
        self.score = score
        self.error: Exception | None = None

    def risk_score(self, consent: OpenFinanceConsent) -> Decimal:
        if self.error:
            raise self.error
        return Decimal(self.score)


@pytest.fixture
def open_finance():
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.server.calls += 1
            time.sleep(self.server.delay_s)
            payload = json.dumps({"score_riesgo": "0.62"}).encode()
            try:
                self.send_response(self.server.status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.delay_s = 0
    server.status = 200
    server.calls = 0
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield server
    server.shutdown()


@pytest.fixture(autouse=True)
def restore_container():
    container.socios.socios.clear()
    container.configuraciones.configuraciones.clear()
    original = container.resolve_risk_profile
    yield
    container.resolve_risk_profile = original


def _resolver(server, breaker: CircuitBreaker | None = None) -> ResolveRiskProfileUseCase:
    provider = build_provider(f"http://127.0.0.1:{server.server_port}", None, 0.2, breaker)
    return ResolveRiskProfileUseCase(provider, InMemoryCache(), ttl_s=60)


# Criterio 1: timeout o caída del proveedor → circuito abierto y respuesta con caché o valor por defecto.


def test_timeout_resolves_with_default_and_records_the_reason(open_finance):
    open_finance.delay_s = 0.5

    signal = _resolver(open_finance).execute(CONSENT)

    assert signal.origen is SignalOrigin.DEFAULT
    assert signal.motivo is DegradationReason.TIMEOUT
    assert signal.obtenido_en is None


def test_provider_error_is_recorded_as_such(open_finance):
    open_finance.status = 503

    signal = _resolver(open_finance).execute(CONSENT)

    assert signal.origen is SignalOrigin.DEFAULT
    assert signal.motivo is DegradationReason.PROVIDER_ERROR


def test_open_circuit_stops_calling_the_provider(open_finance):
    open_finance.delay_s = 0.5
    breaker = CircuitBreaker("open-finance", failure_threshold=2, reset_timeout_s=30, clock=_Clock())
    resolver = _resolver(open_finance, breaker)
    resolver.execute(CONSENT)
    resolver.execute(CONSENT)

    start = time.perf_counter()
    signal = resolver.execute(CONSENT)
    elapsed = time.perf_counter() - start

    assert open_finance.calls == 2
    assert signal.motivo is DegradationReason.CIRCUIT_OPEN
    assert signal.origen is SignalOrigin.DEFAULT
    assert elapsed < 0.05


def test_unexpected_error_still_resolves_the_quote():
    provider = _FakeProvider()
    provider.error = RuntimeError("boom")

    signal = ResolveRiskProfileUseCase(provider, InMemoryCache(), ttl_s=60).execute(CONSENT)

    assert signal.origen is SignalOrigin.DEFAULT
    assert signal.motivo is DegradationReason.PROVIDER_ERROR


# Criterio 2: la respuesta degradada queda marcada para que actuaría reconstruya la decisión.


def test_cached_score_keeps_the_date_it_was_obtained():
    provider = _FakeProvider()
    resolver = ResolveRiskProfileUseCase(provider, InMemoryCache(), ttl_s=60, now=lambda: FIRST_READ)
    fresh = resolver.execute(CONSENT)

    provider.error = ProviderFailure(DegradationReason.TIMEOUT)
    degraded = resolver.execute(CONSENT)

    assert fresh.origen is SignalOrigin.PROVIDER
    assert fresh.motivo is None
    assert fresh.obtenido_en == FIRST_READ
    assert degraded.origen is SignalOrigin.CACHE
    assert degraded.score_riesgo == Decimal("0.7")
    assert degraded.motivo is DegradationReason.TIMEOUT
    assert degraded.obtenido_en == FIRST_READ


def test_score_cached_before_this_change_is_still_used():
    cache = InMemoryCache()
    cache.set(CACHE_KEY, "0.42", 60)
    provider = _FakeProvider()
    provider.error = ProviderFailure(DegradationReason.CIRCUIT_OPEN)

    signal = ResolveRiskProfileUseCase(provider, cache, ttl_s=60).execute(CONSENT)

    assert signal.origen is SignalOrigin.CACHE
    assert signal.score_riesgo == Decimal("0.42")
    assert signal.obtenido_en is None


def test_stored_quote_explains_the_degraded_decision():
    provider = _FakeProvider()
    container.resolve_risk_profile = ResolveRiskProfileUseCase(
        provider, InMemoryCache(), ttl_s=60, now=lambda: FIRST_READ
    )
    signup = {
        "nombre": "Banco Aurora",
        "identificador": "banco-aurora",
        "tipo": "Banco",
        "correo_contacto": "api@aurora.test",
        "alcances": ["cotizacion"],
        "autorizado_por": "Ana Gómez",
    }
    partner = client.post("/gobierno-socios/socios", json=signup).json()
    lines = {"ramos": [{"ramo_id": "ramo-vida-hipotecario", "coberturas": []}], "actualizado_por": "Ana Gómez"}
    client.put(f"/gobierno-socios/socios/{partner['id']}/configuracion", json=lines)
    headers = {"X-Client-Id": partner["client_id"], "X-Api-Key": partner["secreto"]}
    client.post("/gobierno-socios/cotizaciones", json=MORTGAGE, headers=headers)

    provider.error = ProviderFailure(DegradationReason.CIRCUIT_OPEN)
    offer = client.post("/gobierno-socios/cotizaciones", json=MORTGAGE, headers=headers).json()
    stored = client.get(f"/consenso/cotizaciones/{offer['id']}").json()

    assert stored["degradada"] is True
    assert stored["senales"][0]["origen"] == "cache"
    assert stored["senales"][0]["motivo"] == "circuito_abierto"
    assert datetime.fromisoformat(stored["senales"][0]["obtenido_en"]) == FIRST_READ
    assert Decimal(stored["senales"][0]["score_riesgo"]) == Decimal("0.7")


# Criterio 3: al restablecerse el proveedor, el sistema vuelve solo a la ruta normal.


def test_provider_back_returns_to_normal_route_without_intervention(open_finance):
    clock = _Clock()
    breaker = CircuitBreaker("open-finance", failure_threshold=2, reset_timeout_s=30, clock=clock)
    resolver = _resolver(open_finance, breaker)
    open_finance.delay_s = 0.5
    resolver.execute(CONSENT)
    resolver.execute(CONSENT)
    assert resolver.execute(CONSENT).motivo is DegradationReason.CIRCUIT_OPEN

    open_finance.delay_s = 0
    clock.now += 30
    probe = resolver.execute(CONSENT)
    after = resolver.execute(CONSENT)

    assert probe.origen is SignalOrigin.PROVIDER
    assert probe.motivo is None
    assert after.origen is SignalOrigin.PROVIDER
    assert open_finance.calls == 4


def test_breaker_thresholds_come_from_the_environment(monkeypatch):
    monkeypatch.setenv("OPEN_FINANCE_BREAKER_FAILURES", "3")
    monkeypatch.setenv("OPEN_FINANCE_BREAKER_RESET_S", "10")

    settings = CotizacionSettings()

    assert settings.open_finance_breaker_failures == 3
    assert settings.open_finance_breaker_reset_s == 10


def test_provider_uses_the_breaker_it_receives():
    breaker = CircuitBreaker("open-finance", failure_threshold=3, reset_timeout_s=10)

    provider = build_provider("https://open-finance.test", None, 0.3, breaker)

    assert provider.adapter.breaker is breaker
    provider.adapter.client.close()
