"""Una sola cotización: móvil, portal web y socios validan, tarifan y responden igual."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from cotizacion.container import container
from cotizacion.main import app
from cotizacion.signals.domain.models import OpenFinanceConsent
from cotizacion.signals.domain.use_cases import ResolveRiskProfileUseCase
from fastapi.testclient import TestClient
from solventa_common.resilience import InMemoryCache

client = TestClient(app)

SALIDA = date.today() + timedelta(days=20)
TRAVEL = {
    "producto_id": "viaje-internacional",
    "destino": "México",
    "fecha_salida": SALIDA.isoformat(),
    "fecha_regreso": (SALIDA + timedelta(days=7)).isoformat(),
    "viajeros": 2,
}
MORTGAGE = {
    "producto_id": "vida-hipotecario",
    "fecha_nacimiento": "1986-01-01",
    "entidad": "Banco Aurora",
    "valor_credito": "250000000",
    "plazo_anios": 15,
}
NEUTRAL_MORTGAGE_PREMIUM = "3927000.00"


class _FixedScore:
    source = "open-finance"

    def __init__(self, score: str) -> None:
        self.score = score

    def risk_score(self, consent: OpenFinanceConsent) -> Decimal:
        return Decimal(self.score)


@pytest.fixture(autouse=True)
def restore_container():
    container.socios.socios.clear()
    container.configuraciones.configuraciones.clear()
    original = container.resolve_risk_profile
    yield
    container.resolve_risk_profile = original


@pytest.fixture
def partner_headers() -> dict:
    signup = {
        "nombre": "Banco Aurora",
        "identificador": "banco-aurora",
        "tipo": "Banco",
        "correo_contacto": "api@aurora.test",
        "alcances": ["cotizacion"],
        "autorizado_por": "Ana Gómez",
    }
    partner = client.post("/gobierno-socios/socios", json=signup).json()
    lines = [{"ramo_id": "ramo-viaje", "coberturas": []}, {"ramo_id": "ramo-vida-hipotecario", "coberturas": []}]
    client.put(
        f"/gobierno-socios/socios/{partner['id']}/configuracion",
        json={"ramos": lines, "actualizado_por": "Ana Gómez"},
    )
    return {"X-Client-Id": partner["client_id"], "X-Api-Key": partner["secreto"]}


def quote(channel: str, body: dict, partner_headers: dict | None = None):
    if channel == "socios":
        return client.post("/gobierno-socios/cotizaciones", json=body, headers=partner_headers)
    return client.post("/consenso/cotizaciones", json=body, headers={"X-Canal": channel})


CHANNELS = ("mobile", "web", "socios")


@pytest.mark.parametrize("channel", CHANNELS)
def test_same_travel_request_gets_the_same_premium_in_every_channel(channel, partner_headers):
    response = quote(channel, TRAVEL, partner_headers)

    assert response.status_code == 200
    assert response.json()["prima"] == "149940.00"
    assert response.json()["canal"] == channel


@pytest.mark.parametrize("channel", CHANNELS)
def test_invalid_data_is_reported_the_same_way(channel, partner_headers):
    response = quote(channel, {"producto_id": "viaje-internacional", "destino": "Francia"}, partner_headers)

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["codigo"] == "datos_invalidos"
    assert detail["mensaje"] == "La solicitud tiene datos faltantes o inválidos. No se calculó la prima."
    assert {field["campo"] for field in detail["campos"]} == {"destino", "fecha_salida", "fecha_regreso", "viajeros"}


@pytest.mark.parametrize("channel", CHANNELS)
def test_no_channel_quotes_a_trip_that_already_left(channel, partner_headers):
    ayer = date.today() - timedelta(days=1)
    body = {**TRAVEL, "fecha_salida": ayer.isoformat(), "fecha_regreso": date.today().isoformat()}

    response = quote(channel, body, partner_headers)

    assert response.status_code == 422
    assert response.json()["detail"]["campos"] == [
        {"campo": "solicitud", "error": "La fecha de salida no puede ser anterior a hoy"}
    ]


@pytest.mark.parametrize("channel", ("web", "socios"))
def test_nobody_sets_their_own_risk_score(channel, partner_headers):
    response = quote(channel, {**MORTGAGE, "score_riesgo": "0"}, partner_headers)

    assert response.status_code == 200
    assert response.json()["prima"] == NEUTRAL_MORTGAGE_PREMIUM


@pytest.mark.parametrize("channel", ("web", "socios"))
def test_open_finance_consent_prices_the_mortgage_in_any_channel(channel, partner_headers):
    container.resolve_risk_profile = ResolveRiskProfileUseCase(_FixedScore("1"), InMemoryCache(), ttl_s=60)
    consent = {"referencia_cliente": "cliente-9", "consentimiento_id": "consent-9"}

    response = quote(channel, {**MORTGAGE, "consentimiento_open_finance": consent}, partner_headers)

    assert response.status_code == 200
    offer = response.json()
    assert offer["prima"] == "4998000.00"
    assert offer["senales"][0]["origen"] == "proveedor"
    assert offer["degradada"] is False


def test_the_body_does_not_decide_who_owns_the_quote():
    response = client.post(
        "/consenso/cotizaciones",
        json={**TRAVEL, "cliente_id": "otro-cliente"},
        headers={"X-Canal": "mobile", "X-Cliente-Id": "cliente-1"},
    )

    assert response.status_code == 200
    assert container.cotizaciones.get(response.json()["id"]).cliente_id == "cliente-1"


def test_partner_cannot_assign_the_quote_to_a_customer(partner_headers):
    response = quote("socios", {**TRAVEL, "cliente_id": "cliente-1"}, partner_headers)

    assert response.status_code == 200
    assert container.cotizaciones.get(response.json()["id"]).cliente_id is None


def test_rating_uses_the_contract_of_the_product_not_the_shape_of_the_body():
    body = {"producto_id": "viaje-internacional", "suma_asegurada": "1000", "edad": 30}

    for path, headers in (("/consenso/cotizaciones", {"X-Canal": "web"}), ("/cotizaciones/calcular", {})):
        response = client.post(path, json=body, headers=headers)
        assert response.status_code == 422
        assert response.json()["detail"]["codigo"] == "datos_invalidos"


def test_missing_product_is_reported_as_a_field():
    response = client.post("/consenso/cotizaciones", json={"destino": "España"}, headers={"X-Canal": "web"})

    assert response.status_code == 422
    assert response.json()["detail"]["campos"] == [{"campo": "producto_id", "error": "Campo obligatorio"}]


def test_product_without_tariff_is_a_product_error():
    response = client.post(
        "/consenso/cotizaciones",
        json={"producto_id": "proteccion-pagos", "suma_asegurada": "1000000", "edad": 40},
        headers={"X-Canal": "socios"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "codigo": "producto_sin_tarifa",
        "mensaje": "Producto sin tarifa: proteccion-pagos",
    }


def test_a_single_replica_reports_a_product_without_tariff():
    body = {"producto_id": "proteccion-pagos", "suma_asegurada": "1000000", "edad": 40}

    response = client.post("/cotizaciones/calcular", json=body)

    assert response.status_code == 422
    assert response.json()["detail"] == "Producto sin tarifa: proteccion-pagos"


def test_unreachable_replicas_answer_503_with_a_code():
    async def fanout(body: dict, _timeout_s: float) -> list[dict]:
        raise ConnectionRefusedError("sin réplicas")

    original = container.cotizar_con_consenso.fanout
    container.cotizar_con_consenso.fanout = fanout
    try:
        response = client.post("/consenso/cotizaciones", json=TRAVEL, headers={"X-Canal": "web"})
    finally:
        container.cotizar_con_consenso.fanout = original

    assert response.status_code == 503
    assert response.json()["detail"]["codigo"] == "replicas_no_disponibles"
