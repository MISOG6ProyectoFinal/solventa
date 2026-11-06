"""Consulta del back-office: las últimas pólizas de todos los canales."""

from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from polizas.ciclo_vida.adapters.repository import InMemoryPolicyRepository, PostgresPolicyRepository
from polizas.ciclo_vida.api import wire
from polizas.ciclo_vida.domain.models import Policy, PolicyStatus, Validity
from polizas.ciclo_vida.domain.use_cases import ListRecentPoliciesUseCase
from polizas.main import app
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

client = TestClient(app)
EMITIDA = datetime(2026, 11, 1, 12, tzinfo=UTC)


class _NoSource:
    def get(self, resource_id: str) -> None:
        return None


def _policy(n: int, hasta: date = date(2026, 12, 31), **extra) -> Policy:
    return Policy(
        cotizacion_id=f"cot-{n}",
        cobro_id=f"cobro-{n}",
        producto_id="viaje-internacional",
        prima="214200.00",
        vigencia=Validity(desde=date(2026, 1, 1), hasta=hasta),
        canal="mobile",
        cliente_id=f"cliente-{n}",
        idempotency_key=f"mobile:{n}",
        emitida_en=EMITIDA + timedelta(minutes=n),
        **extra,
    )


def test_newest_first_and_limited():
    policies = InMemoryPolicyRepository()
    for n in range(3):
        policies.add(_policy(n))

    recent = ListRecentPoliciesUseCase(policies, today=lambda: date(2026, 11, 5)).execute(2)

    assert [policy.cotizacion_id for policy in recent] == ["cot-2", "cot-1"]


def test_expired_policies_are_reported_as_expired():
    policies = InMemoryPolicyRepository()
    policies.add(_policy(1, hasta=date(2026, 11, 1)))

    [policy] = ListRecentPoliciesUseCase(policies, today=lambda: date(2026, 11, 5)).execute(10)

    assert policy.estado is PolicyStatus.EXPIRED


def test_postgres_lists_the_newest_first():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    policies = PostgresPolicyRepository(engine)
    policies.create_schema()
    for n in range(3):
        policies.add(_policy(n))

    assert [policy.cotizacion_id for policy in policies.list_recent(2)] == ["cot-2", "cot-1"]


def test_api_lists_recent_policies_and_validates_the_limit():
    policies = InMemoryPolicyRepository()
    policies.add(_policy(1))
    wire(policies, _NoSource(), _NoSource())

    response = client.get("/polizas/recientes", params={"limite": 5})

    assert response.status_code == 200
    assert [policy["cotizacion_id"] for policy in response.json()] == ["cot-1"]
    assert client.get("/polizas/recientes", params={"limite": 0}).status_code == 422
