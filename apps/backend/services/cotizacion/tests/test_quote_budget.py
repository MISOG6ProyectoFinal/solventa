"""ASR-02: una cotización comparte un solo presupuesto, corta al tener quórum y reusa la señal reciente."""

import asyncio
import time
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from cotizacion.consenso.adapters import replicas
from cotizacion.consenso.adapters.replicas import cotizar_en_replicas
from cotizacion.container import container
from cotizacion.signals.domain.models import OpenFinanceConsent, SignalOrigin
from cotizacion.signals.domain.use_cases import ResolveRiskProfileUseCase
from solventa_common.resilience import InMemoryCache

BODY = {"producto_id": "hogar"}


def _replicas(delays: dict[str, float], premiums: dict[str, str], status: int = 200) -> httpx.MockTransport:
    async def handler(request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(delays[request.url.host])
        return httpx.Response(status, json={"prima": premiums[request.url.host]})

    return httpx.MockTransport(handler)


def test_the_fanout_answers_as_soon_as_two_replicas_agree():
    transport = _replicas({"a": 0.0, "b": 0.01, "c": 2.0}, {"a": "100.00", "b": "100.00", "c": "100.00"})

    started = time.monotonic()
    answers = asyncio.run(cotizar_en_replicas(["a", "b", "c"], 8000, BODY, 1.0, 2, transport))

    assert [answer["prima"] for answer in answers] == ["100.00", "100.00"]
    assert time.monotonic() - started < 0.5


def test_the_fanout_keeps_waiting_while_the_replicas_disagree():
    transport = _replicas({"a": 0.0, "b": 0.01, "c": 0.02}, {"a": "100.00", "b": "999.00", "c": "100.00"})

    answers = asyncio.run(cotizar_en_replicas(["a", "b", "c"], 8000, BODY, 1.0, 2, transport))

    assert sorted(answer["prima"] for answer in answers) == ["100.00", "100.00", "999.00"]


def test_the_fanout_stops_at_the_total_deadline():
    transport = _replicas({"a": 0.0, "b": 2.0, "c": 2.0}, {"a": "100.00", "b": "100.00", "c": "100.00"})

    started = time.monotonic()
    answers = asyncio.run(cotizar_en_replicas(["a", "b", "c"], 8000, BODY, 0.1, 2, transport))

    assert [answer["prima"] for answer in answers] == ["100.00"]
    assert time.monotonic() - started < 0.5


def test_replicas_that_fail_are_not_counted():
    transport = _replicas({"a": 0.0, "b": 0.0, "c": 0.0}, {"a": "1", "b": "1", "c": "1"}, status=500)

    assert asyncio.run(cotizar_en_replicas(["a", "b", "c"], 8000, BODY, 0.2, 2, transport)) == []


def test_without_quorum_from_the_replicas_the_quote_is_computed_locally(monkeypatch):
    async def one_answer(*_args, **_kwargs):
        return [{"prima": "1.00"}]

    monkeypatch.setattr("cotizacion.container.resolver_replicas", lambda *_: ["replica-a", "replica-b", "replica-c"])
    monkeypatch.setattr("cotizacion.container.cotizar_en_replicas", one_answer)
    body = {
        "producto_id": "viaje-internacional",
        "destino": "España",
        "fecha_salida": "2027-01-10",
        "fecha_regreso": "2027-01-20",
        "viajeros": 1,
    }

    answers = asyncio.run(container._fanout_produccion(body, 0.2))

    assert len(answers) == 3
    assert len({answer["prima"] for answer in answers}) == 1


def test_the_fanout_gets_only_what_is_left_of_the_budget():
    seen: list[float] = []

    async def fanout(body: dict, timeout_s: float) -> list[dict]:
        seen.append(timeout_s)
        raise RuntimeError("detener aquí")

    class _Request:
        def model_dump(self, **_kwargs):
            return BODY

    use_case = container.cotizar_con_consenso
    original = use_case.fanout
    use_case.fanout = fanout
    try:
        for budget in (0.2, 5.0, -1.0):
            with pytest.raises(RuntimeError):
                asyncio.run(use_case.execute(_Request(), None, None, budget_s=budget))
    finally:
        use_case.fanout = original

    assert seen == [0.2, use_case.fanout_timeout_s, 0.05]


class _Provider:
    source = "open-finance"

    def __init__(self) -> None:
        self.calls = 0

    def risk_score(self, consent: OpenFinanceConsent) -> Decimal:
        self.calls += 1
        return Decimal("0.3")


CONSENT = OpenFinanceConsent(referencia_cliente="CLI-1", consentimiento_id="CNS-1")
NOW = datetime(2026, 11, 11, 10, 0, tzinfo=UTC)


def test_a_recent_signal_is_reused_without_calling_the_provider():
    clock = [NOW]
    provider = _Provider()
    resolve = ResolveRiskProfileUseCase(provider, InMemoryCache(), 86_400, now=lambda: clock[0], fresh_s=300)

    first = resolve.execute(CONSENT)
    clock[0] = NOW + timedelta(minutes=4)
    second = resolve.execute(CONSENT)
    clock[0] = NOW + timedelta(minutes=6)
    third = resolve.execute(CONSENT)

    origins = (first.origen, second.origen, third.origen)
    assert origins == (SignalOrigin.PROVIDER, SignalOrigin.CACHE, SignalOrigin.PROVIDER)
    assert second.score_riesgo == Decimal("0.3")
    assert second.motivo is None
    assert provider.calls == 2


def test_without_a_fresh_window_the_provider_is_always_asked():
    provider = _Provider()
    resolve = ResolveRiskProfileUseCase(provider, InMemoryCache(), 86_400, now=lambda: NOW)

    resolve.execute(CONSENT)
    resolve.execute(CONSENT)

    assert provider.calls == 2


def test_the_replica_module_keeps_the_premium_comparison_to_the_cent():
    assert replicas._premium({"prima": "100.004"}) == replicas._premium({"prima": "100.00"})
