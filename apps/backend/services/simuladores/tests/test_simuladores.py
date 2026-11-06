import time

import pytest
from fastapi.testclient import TestClient
from simuladores.control import PROVIDERS, Mode
from simuladores.main import app
from simuladores.providers import charges, outbox, risk_score

client = TestClient(app)

CHARGE = {"amount": 357000.0, "currency": "COP", "token": "demo-4242"}


@pytest.fixture(autouse=True)
def reset():
    for provider in PROVIDERS.values():
        provider.mode = Mode.NORMAL
        provider.delay_s = 2.0
        provider.calls.clear()
    charges.clear()
    outbox.clear()


def set_mode(provider: str, modo: str, **extra):
    return client.put(f"/simuladores/{provider}/modo", json={"modo": modo, **extra})


def test_lists_every_simulated_provider():
    response = client.get("/simuladores")

    assert response.status_code == 200
    assert [p["proveedor"] for p in response.json()] == [
        "open-finance",
        "pasarela-pagos",
        "notificaciones",
        "red-asistencia",
    ]
    assert {p["modo"] for p in response.json()} == {"normal"}


def test_open_finance_gives_the_same_score_to_the_same_customer():
    first = client.get("/open-finance/customers/cliente-77/profile", params={"consent": "c-1"})
    second = client.get("/open-finance/customers/cliente-77/profile", params={"consent": "c-1"})

    assert first.status_code == 200
    assert first.json()["score_riesgo"] == second.json()["score_riesgo"] == risk_score("cliente-77")
    assert 0.3 <= float(risk_score("cliente-77")) <= 0.7


def test_down_answers_503_and_counts_the_call():
    set_mode("open-finance", "caido")

    response = client.get("/open-finance/customers/cliente-77/profile")

    assert response.status_code == 503
    assert client.get("/simuladores/open-finance").json()["llamadas"] == {"caido": 1}


def test_slow_answers_after_the_configured_delay():
    assert set_mode("open-finance", "lento", demora_s=0.2).json()["demora_s"] == 0.2

    start = time.perf_counter()
    response = client.get("/open-finance/customers/cliente-77/profile")

    assert response.status_code == 200
    assert time.perf_counter() - start >= 0.2


@pytest.mark.parametrize(
    ("path", "method", "body", "headers"),
    [
        ("/open-finance/customers/c/profile", "GET", None, {}),
        ("/pasarela-pagos/charges", "POST", CHARGE, {"Idempotency-Key": "k-1"}),
        ("/notificaciones/notifications", "POST", {"channel": "sms", "to": "300", "template": "otp"}, {}),
        ("/red-asistencia/despachos", "POST", {"servicio": "grua", "ubicacion": "Bogotá"}, {}),
    ],
)
def test_invalid_answers_a_body_the_adapter_does_not_recognize(path, method, body, headers):
    provider = path.split("/")[1]
    set_mode(provider, "invalida")

    response = client.request(method, path, json=body, headers=headers)

    assert response.is_success
    assert "score_riesgo" not in response.json()
    assert "status" not in response.json()
    assert "numero" not in response.json()


def test_gateway_approves_only_the_demo_token_and_respects_idempotency():
    approved = client.post("/pasarela-pagos/charges", json=CHARGE, headers={"Idempotency-Key": "k-1"})
    rejected = client.post(
        "/pasarela-pagos/charges", json={**CHARGE, "token": "demo-rechazo"}, headers={"Idempotency-Key": "k-2"}
    )
    replay = client.post(
        "/pasarela-pagos/charges", json={**CHARGE, "token": "demo-rechazo"}, headers={"Idempotency-Key": "k-1"}
    )

    assert approved.json()["status"] == "approved"
    assert rejected.json()["status"] == "rejected"
    assert replay.json() == approved.json()


def test_notifications_keep_an_outbox_to_read_the_otp():
    body = {"channel": "sms", "to": "3001234567", "template": "otp-consentimiento", "data": {"codigo": "123456"}}
    sent = client.post("/notificaciones/notifications", json=body)
    client.post("/notificaciones/notifications", json={**body, "to": "otro"})

    assert sent.status_code == 202
    assert sent.json()["status"] == "sent"
    inbox = client.get("/simuladores/notificaciones/mensajes", params={"to": "3001234567"}).json()
    assert [m["data"]["codigo"] for m in inbox] == ["123456"]
    assert len(client.get("/simuladores/notificaciones/mensajes").json()) == 2


def test_unknown_provider_and_invalid_mode_are_rejected():
    assert client.get("/simuladores/kyc").status_code == 404
    assert client.get("/simuladores/kyc").json()["detail"]["codigo"] == "proveedor_no_encontrado"
    assert set_mode("open-finance", "roto").status_code == 422
    assert set_mode("open-finance", "lento", demora_s=0).status_code == 422


def test_calls_can_be_reset():
    client.get("/open-finance/customers/c/profile")

    assert client.delete("/simuladores/open-finance/llamadas").status_code == 204
    assert client.get("/simuladores/open-finance").json()["llamadas"] == {}


def test_assistance_network_assigns_a_number_and_arrival_time():
    response = client.post("/red-asistencia/despachos", json={"servicio": "ambulancia", "ubicacion": "Calle 85"})

    assert response.status_code == 200
    assert response.json()["numero"].startswith("AST-")
    assert (response.json()["eta_min"], response.json()["eta_max"]) == (10, 20)
