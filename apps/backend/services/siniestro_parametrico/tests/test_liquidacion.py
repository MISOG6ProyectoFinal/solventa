from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from decimal import Decimal

from siniestro_parametrico.adapters.repository import InMemoryLiquidacionRepository
from siniestro_parametrico.domain.models import EventoParametrico
from siniestro_parametrico.domain.use_cases import (
    SINIESTRO_LIQUIDADO,
    LiquidarEventoUseCase,
    RegistrarEventoUseCase,
)
from solventa_common.events import InMemoryEventPublisher
from solventa_common.idempotency import InMemoryIdempotencyKeyValidator


def evento(valor="120") -> EventoParametrico:
    return EventoParametrico(
        fuente="ideam",
        clave_evento="lluvia-2026-10-01-bog",
        poliza_id="POL-1",
        tipo="precipitacion_mm",
        valor_observado=Decimal(valor),
        umbral=Decimal("100"),
        monto_asegurado=Decimal("5000000"),
        observado_en=datetime(2026, 10, 1, tzinfo=UTC),
    )


def build():
    bus, repo = InMemoryEventPublisher(), InMemoryLiquidacionRepository()
    return bus, repo, LiquidarEventoUseCase(InMemoryIdempotencyKeyValidator(), repo, bus)


def test_reentregas_concurrentes_liquidan_una_sola_vez():
    bus, repo, liquidar = build()
    event = RegistrarEventoUseCase(InMemoryEventPublisher()).execute(evento())
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda _: liquidar.execute(event), range(50)))
    assert len(repo.items) == 1
    assert [e.event_type for e in bus.events] == [SINIESTRO_LIQUIDADO]


def test_bajo_umbral_no_liquida():
    _, repo, liquidar = build()
    event = RegistrarEventoUseCase(InMemoryEventPublisher()).execute(evento(valor="80"))
    assert liquidar.execute(event) is None
    assert repo.items == []
