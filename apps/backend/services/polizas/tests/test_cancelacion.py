"""HU007: cancelación con recálculo de devolución (Cotización) y evento PolizaCancelada."""

from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient
from polizas.ciclo_vida.adapters.repository import InMemoryPolicyRepository, PostgresPolicyRepository
from polizas.ciclo_vida.adapters.upstream import RefundCalculatorClient
from polizas.ciclo_vida.api import wire
from polizas.ciclo_vida.domain.models import Policy, PolicyStatus, Validity
from polizas.ciclo_vida.domain.ports import RefundUnavailable
from polizas.main import app
from solventa_common.events import InMemoryEventPublisher
from solventa_common.resilience import CircuitOpenError
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

client = TestClient(app)


class _Source:
    def get(self, resource_id: str) -> None:
        return None


class _Refunds:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[tuple] = []

    def calculate(self, policy, cancellation_date, refundable):
        if self.fail:
            raise RefundUnavailable("caído")
        self.calls.append((policy.id, cancellation_date, refundable))
        return {"dias_vigencia": 365, "dias_no_devengados": 100, "monto_reintegro": "27397" if refundable else "0"}


def _policy(**changes) -> Policy:
    data = {
        "id": "poliza-1",
        "cotizacion_id": "cot-1",
        "cobro_id": "cobro-1",
        "producto_id": "viaje-internacional",
        "prima": Decimal("100000.00"),
        "vigencia": Validity(desde=date(2090, 1, 1), hasta=date(2090, 12, 31)),
        "canal": "web",
        "idempotency_key": "clave-1",
        "emitida_en": datetime(2090, 1, 1, tzinfo=UTC),
    }
    return Policy(**{**data, **changes})


@pytest.fixture(params=["memoria", "sql"])
def setup(request):
    if request.param == "memoria":
        repository = InMemoryPolicyRepository()
    else:
        engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
        repository = PostgresPolicyRepository(engine)
    if hasattr(repository, "create_schema"):
        repository.create_schema()
    repository.add(_policy())
    repository.add(
        _policy(id="poliza-2", cotizacion_id="cot-2", idempotency_key="clave-2", estado=PolicyStatus.CANCELLED)
    )
    publisher, refunds = InMemoryEventPublisher(), _Refunds()
    wire(repository, _Source(), _Source(), publisher, refunds)
    return repository, publisher, refunds


def _body(causa: str = "retracto") -> dict:
    return {"causa": causa, "usuario_id": "op-1"}


def test_cancelar_marca_la_poliza_guarda_causa_y_publica_el_evento(setup):
    repository, publisher, refunds = setup

    response = client.post("/polizas/poliza-1/cancelacion", json=_body())

    assert response.status_code == 200
    assert Decimal(str(response.json()["monto_reintegro"])) == Decimal(27397)
    policy = repository.get("poliza-1")
    assert policy.estado is PolicyStatus.CANCELLED
    assert policy.causa_cancelacion == "retracto"
    assert policy.fecha_cancelacion == datetime.now(UTC).date()
    [event] = publisher.events
    assert event.event_type == "poliza.cancelada"
    assert event.payload == {
        "poliza_id": "poliza-1",
        "causa_cancelacion": "retracto",
        "usuario_id": "op-1",
        "monto_reintegro": "27397",
    }
    assert refunds.calls[0][2] is True


def test_causa_no_reembolsable_pide_devolucion_cero(setup):
    _, publisher, refunds = setup

    client.post("/polizas/poliza-1/cancelacion", json=_body("impago-de-prima"))

    assert refunds.calls[0][2] is False
    assert publisher.events[0].payload["monto_reintegro"] == "0"


def test_el_calculo_no_cambia_la_poliza(setup):
    repository, publisher, _ = setup

    response = client.post("/polizas/poliza-1/cancelacion/calculo", json={"causa": "retracto"})

    assert response.status_code == 200
    assert repository.get("poliza-1").estado is PolicyStatus.ACTIVE
    assert publisher.events == []


def test_poliza_ya_cancelada_responde_409(setup):
    _, publisher, _ = setup

    response = client.post("/polizas/poliza-2/cancelacion", json=_body())

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "poliza_no_cancelable"
    assert publisher.events == []


def test_poliza_inexistente_responde_404(setup):
    assert client.post("/polizas/no-existe/cancelacion", json=_body()).status_code == 404


def test_si_cotizacion_falla_responde_503_y_no_cancela(setup):
    repository, publisher, _ = setup
    wire(repository, _Source(), _Source(), publisher, _Refunds(fail=True))

    response = client.post("/polizas/poliza-1/cancelacion", json=_body())

    assert response.status_code == 503
    assert repository.get("poliza-1").estado is PolicyStatus.ACTIVE
    assert publisher.events == []


def test_causa_desconocida_se_rechaza(setup):
    assert client.post("/polizas/poliza-1/cancelacion", json=_body("otra")).status_code == 422


def test_una_poliza_cancelada_ya_no_admite_endosos(setup):
    client.post("/polizas/poliza-1/cancelacion", json=_body())
    anterior = {"nombre": "A", "telefono": "1", "correo": "a@a.co", "direccion": "x"}
    response = client.post(
        "/polizas/poliza-1/endosos",
        json={
            "usuario_id": "op-1",
            "fecha_efectiva": "2090-06-01",
            "motivo": "cambio",
            "datos_identidad": anterior,
            "version_nueva": {**anterior, "telefono": "2"},
        },
    )
    assert response.status_code == 409


def test_refund_calculator_client_exito():
    mock_service = MagicMock()
    mock_service.post.return_value = {"monto_reintegro": "50000"}
    client_refund = RefundCalculatorClient(mock_service)

    result = client_refund.calculate(_policy(), date(2026, 6, 1), True)
    assert result == {"monto_reintegro": "50000"}
    mock_service.post.assert_called_once()


def test_refund_calculator_client_circuit_open_lanza_indisponibilidad():
    mock_service = MagicMock()
    mock_service.post.side_effect = CircuitOpenError("cotizacion")
    client_refund = RefundCalculatorClient(mock_service)

    with pytest.raises(RefundUnavailable):
        client_refund.calculate(_policy(), date(2026, 6, 1), True)


def test_refund_calculator_client_http_error_lanza_indisponibilidad():
    mock_service = MagicMock()
    mock_service.post.side_effect = httpx.ConnectError("timeout")
    client_refund = RefundCalculatorClient(mock_service)

    with pytest.raises(RefundUnavailable):
        client_refund.calculate(_policy(), date(2026, 6, 1), True)
