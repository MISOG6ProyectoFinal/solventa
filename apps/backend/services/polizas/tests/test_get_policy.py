"""HU016: lectura de una póliza por su identificador, con el estado de hoy."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from polizas.ciclo_vida.adapters.repository import InMemoryPolicyRepository
from polizas.ciclo_vida.api import wire
from polizas.ciclo_vida.domain.models import Policy, PolicyStatus, Validity
from polizas.ciclo_vida.domain.ports import PolicyNotFound
from polizas.ciclo_vida.domain.use_cases import GetPolicyUseCase
from polizas.main import app

client = TestClient(app)


class _NoSource:
    def get(self, resource_id: str) -> None:
        return None


def _policy(desde: date = date(2026, 1, 1), hasta: date = date(2026, 12, 31)) -> Policy:
    return Policy(
        cotizacion_id="cot-1",
        cobro_id="cobro-1",
        producto_id="viaje-internacional",
        prima="214200.00",
        vigencia=Validity(desde=desde, hasta=hasta),
        canal="socios",
        socio_id="socio-1",
        idempotency_key="socios:socio-1:emision-1",
    )


def _use_case(policy: Policy, today: date) -> GetPolicyUseCase:
    policies = InMemoryPolicyRepository()
    policies.add(policy)
    return GetPolicyUseCase(policies, today=lambda: today)


def test_policy_within_its_validity_is_active():
    policy = _policy()

    found = _use_case(policy, date(2026, 12, 31)).execute(policy.id)

    assert found.estado is PolicyStatus.ACTIVE


def test_policy_after_its_validity_is_stored_as_expired():
    policy = _policy()
    use_case = _use_case(policy, date(2027, 1, 1))

    found = use_case.execute(policy.id)

    assert found.estado is PolicyStatus.EXPIRED
    assert use_case.policies.get_by_id(policy.id).estado is PolicyStatus.EXPIRED


def test_unknown_policy_raises_not_found():
    with pytest.raises(PolicyNotFound):
        GetPolicyUseCase(InMemoryPolicyRepository()).execute("no-existe")


def test_api_returns_the_policy_and_an_explicit_not_found():
    policies = InMemoryPolicyRepository()
    policy = _policy(hasta=date(2099, 12, 31))
    policies.add(policy)
    wire(policies, _NoSource(), _NoSource())

    found = client.get(f"/polizas/{policy.id}")
    missing = client.get("/polizas/no-existe")

    assert found.status_code == 200
    assert found.json()["numero"] == policy.numero
    assert found.json()["estado"] == "activa"
    assert found.json()["socio_id"] == "socio-1"
    assert missing.status_code == 404
    assert missing.json()["detail"]["codigo"] == "poliza_no_encontrada"
