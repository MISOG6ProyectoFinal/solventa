"""Un aviso solo se abre sobre una póliza activa del mismo cliente."""

import httpx
import pytest
from fastapi.testclient import TestClient
from siniestros.avisos import api
from siniestros.avisos.adapters.memory import InMemoryAvisoRepository, InMemoryObjectStore
from siniestros.avisos.adapters.policies import PolizasDirectory
from siniestros.main import app
from solventa_common.resilience import CircuitOpenError

client = TestClient(app)

AVISO = {
    "cliente_id": "cliente-1",
    "poliza_id": "pol-1",
    "tipo": "Robo",
    "ocurrido_en": "2026-10-01T00:00:00Z",
    "descripcion": "Me robaron el equipaje",
}
POLICY = {"id": "pol-1", "cliente_id": "cliente-1", "estado": "activa"}


class _Policies:
    def __init__(self, answer) -> None:
        self.answer = answer
        self.asked: list[str] = []

    def get(self, poliza_id: str):
        self.asked.append(poliza_id)
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer


def _wire(answer) -> _Policies:
    policies = _Policies(answer)
    api.wire(InMemoryAvisoRepository(), InMemoryObjectStore(), bucket="evidencias", policies=policies)
    return policies


def test_a_claim_on_an_active_policy_of_the_customer_is_opened():
    policies = _wire(POLICY)

    response = client.post("/siniestros/avisos", json=AVISO)

    assert response.status_code == 201
    assert policies.asked == ["pol-1"]


@pytest.mark.parametrize(
    "policy",
    [None, POLICY | {"cliente_id": "otro"}, POLICY | {"estado": "cancelada"}, POLICY | {"estado": "vencida"}],
    ids=["no-existe", "de-otro-cliente", "cancelada", "vencida"],
)
def test_a_claim_on_a_foreign_missing_or_inactive_policy_is_rejected(policy):
    _wire(policy)

    response = client.post("/siniestros/avisos", json=AVISO)

    assert response.status_code == 422
    assert response.json()["detail"] == "La póliza no existe, no es del cliente o no está activa."
    assert client.get("/siniestros/avisos", headers={"X-Cliente-Id": "cliente-1"}).json() == []


def test_the_claim_waits_when_policies_cannot_be_checked():
    _wire(CircuitOpenError("polizas"))

    response = client.post("/siniestros/avisos", json=AVISO)

    assert response.status_code == 503


def _directory(status: int) -> PolizasDirectory:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.raw_path == b"/polizas/pol%2F1"
        return httpx.Response(status, json=POLICY)

    service = type("Client", (), {})()
    http = httpx.Client(base_url="https://polizas", transport=httpx.MockTransport(handler))

    def get(path: str):
        response = http.get(path)
        response.raise_for_status()
        return response.json()

    service.get = get
    return PolizasDirectory(service)


def test_the_directory_reads_the_policy_and_treats_404_as_missing():
    assert _directory(200).get("pol/1") == POLICY
    assert _directory(404).get("pol/1") is None
    with pytest.raises(httpx.HTTPStatusError):
        _directory(500).get("pol/1")
