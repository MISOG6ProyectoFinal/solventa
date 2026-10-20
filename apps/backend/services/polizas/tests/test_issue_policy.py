"""HU015: emisión de póliza con cotización vigente y cobro aprobado, una sola vez por cotización."""

import httpx
import pytest
from fastapi.testclient import TestClient
from polizas.ciclo_vida.adapters.repository import InMemoryPolicyRepository, PostgresPolicyRepository
from polizas.ciclo_vida.adapters.repository import policies as policies_table
from polizas.ciclo_vida.adapters.upstream import QuoteReader
from polizas.ciclo_vida.api import wire
from polizas.main import app
from solventa_common.integration import ServiceClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.pool import StaticPool

client = TestClient(app)

QUOTE = {
    "id": "cot-1",
    "producto_id": "viaje-internacional",
    "prima": "214200.00",
    "coberturas": [{"id": "viaje-asistencia", "nombre": "Asistencia en viaje"}],
    "vigencia_propuesta": {"desde": "2027-01-10", "hasta": "2027-01-20"},
    "vigente_hasta": "2099-01-01T23:59:59-05:00",
    "canal": "socios",
    "socio_id": "socio-1",
}
PAYMENT = {
    "id": "cobro-1",
    "cotizacion_id": "cot-1",
    "estado": "aprobado",
    "monto": "214200.00",
    "moneda": "COP",
    "creado_en": "2026-10-20T15:00:00+00:00",
}
REQUEST = {
    "cotizacion_id": "cot-1",
    "cobro_id": "cobro-1",
    "idempotency_key": "socios:socio-1:emision-1",
    "canal": "socios",
    "socio_id": "socio-1",
}


class _Source:
    def __init__(self, *items: dict) -> None:
        self.items = {item["id"]: item for item in items}
        self.calls = 0

    def get(self, resource_id: str) -> dict | None:
        self.calls += 1
        return self.items.get(resource_id)


@pytest.fixture
def stores():
    quotes, payments = _Source(QUOTE), _Source(PAYMENT)
    policies = InMemoryPolicyRepository()
    wire(policies, quotes, payments)
    return policies, quotes, payments


def _issue(**changes):
    return client.post("/polizas/emisiones", json=REQUEST | changes)


def test_issues_policy_with_valid_quote_and_approved_payment(stores):
    response = _issue()

    assert response.status_code == 201
    policy = response.json()
    assert policy["numero"].startswith("POL-")
    assert policy["estado"] == "activa"
    assert policy["vigencia"] == {"desde": "2027-01-10", "hasta": "2027-01-20"}
    assert policy["prima"] == "214200.00"
    assert policy["coberturas"] == QUOTE["coberturas"]
    assert policy["socio_id"] == "socio-1"


def test_same_key_returns_the_same_policy_without_reading_upstream_again(stores):
    policies, quotes, payments = stores
    first = _issue().json()
    calls = quotes.calls + payments.calls

    again = _issue()

    assert again.status_code == 200
    assert again.json()["id"] == first["id"]
    assert len(policies.items) == 1
    assert quotes.calls + payments.calls == calls


def test_another_key_for_an_issued_quote_returns_the_existing_policy(stores):
    policies, _, _ = stores
    first = _issue().json()

    again = _issue(idempotency_key="socios:socio-1:emision-2")

    assert again.status_code == 200
    assert again.json()["id"] == first["id"]
    assert len(policies.items) == 1


def test_key_reused_for_another_quote_is_rejected(stores):
    _, quotes, payments = stores
    quotes.items["cot-2"] = QUOTE | {"id": "cot-2"}
    payments.items["cobro-2"] = PAYMENT | {"id": "cobro-2", "cotizacion_id": "cot-2"}
    _issue()

    response = _issue(cotizacion_id="cot-2", cobro_id="cobro-2")

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "clave_reutilizada"


@pytest.mark.parametrize(
    "payment",
    [
        PAYMENT | {"estado": "rechazado"},
        PAYMENT | {"estado": "procesando"},
        PAYMENT | {"cotizacion_id": "otra"},
        PAYMENT | {"monto": "1.00"},
    ],
    ids=["rejected", "processing", "other-quote", "other-amount"],
)
def test_payment_not_approved_for_the_quote_does_not_issue(stores, payment):
    policies, _, payments = stores
    payments.items["cobro-1"] = payment

    response = _issue()

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "pago_no_aprobado"
    assert policies.items == []


def test_unknown_payment_does_not_issue(stores):
    policies, _, _ = stores

    response = _issue(cobro_id="no-existe")

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "pago_no_aprobado"
    assert policies.items == []


def test_expired_quote_without_payment_in_time_does_not_issue(stores):
    policies, quotes, payments = stores
    quotes.items["cot-1"] = QUOTE | {"vigente_hasta": "2026-10-19T23:59:59-05:00"}
    payments.items["cobro-1"] = PAYMENT | {"creado_en": "2026-10-20T15:00:00+00:00"}

    response = _issue()

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "cotizacion_vencida"
    assert policies.items == []


def test_quote_paid_before_expiry_is_issued_even_after_expiry(stores):
    _, quotes, payments = stores
    quotes.items["cot-1"] = QUOTE | {"vigente_hasta": "2026-10-19T23:59:59-05:00"}
    payments.items["cobro-1"] = PAYMENT | {"creado_en": "2026-10-19T20:00:00-05:00"}

    assert _issue().status_code == 201


@pytest.mark.parametrize(
    "changes",
    [{"socio_id": "otro-socio"}, {"socio_id": None}, {"cotizacion_id": "no-existe"}],
    ids=["other-partner", "no-partner", "unknown-quote"],
)
def test_quote_outside_the_caller_scope_is_not_found(stores, changes):
    policies, _, _ = stores

    response = _issue(**changes)

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "cotizacion_no_encontrada"
    assert policies.items == []


def test_mobile_owner_is_checked_by_client(stores):
    _, quotes, payments = stores
    quotes.items["cot-m"] = QUOTE | {"id": "cot-m", "canal": "mobile", "socio_id": None, "cliente_id": "cliente-1"}
    payments.items["cobro-m"] = PAYMENT | {"id": "cobro-m", "cotizacion_id": "cot-m"}
    body = {"cotizacion_id": "cot-m", "cobro_id": "cobro-m", "idempotency_key": "movil:1", "canal": "mobile"}

    assert client.post("/polizas/emisiones", json=body | {"cliente_id": "otro"}).status_code == 404
    assert client.post("/polizas/emisiones", json=body | {"cliente_id": "cliente-1"}).status_code == 201


def test_postgres_keeps_one_policy_per_quote_and_key():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    policies = PostgresPolicyRepository(engine)
    wire(policies, _Source(QUOTE), _Source(PAYMENT))

    first = _issue().json()
    again = _issue(idempotency_key="socios:socio-1:emision-2").json()

    assert again["id"] == first["id"]
    with engine.connect() as conn:
        assert conn.execute(select(func.count()).select_from(policies_table)).scalar_one() == 1
    stored = policies.get_by_idempotency_key(REQUEST["idempotency_key"])
    assert stored.numero == first["numero"]
    assert str(stored.vigencia.hasta) == "2027-01-20"


def test_upstream_down_returns_503_and_issues_nothing():
    def handler(request):
        raise httpx.ConnectError("down")

    service = ServiceClient("cotizacion", "http://cotizacion.test")
    service.client = httpx.Client(base_url="http://cotizacion.test", transport=httpx.MockTransport(handler))
    policies = InMemoryPolicyRepository()
    wire(policies, QuoteReader(service), _Source(PAYMENT))

    response = _issue()

    assert response.status_code == 503
    assert policies.items == []


def test_quote_reader_maps_404_to_missing():
    def handler(request):
        return httpx.Response(404, json={"detail": "no"})

    service = ServiceClient("cotizacion", "http://cotizacion.test")
    service.client = httpx.Client(base_url="http://cotizacion.test", transport=httpx.MockTransport(handler))

    assert QuoteReader(service).get("cot-1") is None
