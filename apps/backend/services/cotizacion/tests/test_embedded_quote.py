"""HU014: API de cotización embebida para el socio de distribución."""

import json
import threading
import time
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from statistics import quantiles

import httpx
import pytest
from cotizacion.config import CotizacionSettings
from cotizacion.container import container
from cotizacion.main import app
from cotizacion.signals.adapters.open_finance import (
    OpenFinanceQuoteAdapter,
    OpenFinanceRiskProfile,
    SandboxRiskProfile,
    build_provider,
)
from cotizacion.signals.domain.models import OpenFinanceConsent, SignalOrigin
from cotizacion.signals.domain.use_cases import ResolveRiskProfileUseCase
from fastapi.testclient import TestClient
from pydantic import ValidationError
from solventa_common.resilience import InMemoryCache

client = TestClient(app)

TRAVEL = {
    "producto_id": "viaje-internacional",
    "destino": "España",
    "fecha_salida": "2027-01-10",
    "fecha_regreso": "2027-01-20",
    "viajeros": 2,
}
MORTGAGE = {
    "producto_id": "vida-hipotecario",
    "fecha_nacimiento": "1986-01-01",
    "entidad": "Banco Aurora",
    "valor_credito": "250000000",
    "plazo_anios": 15,
}
CONSENT = {"referencia_cliente": "cliente-77", "consentimiento_id": "consent-1"}
NEUTRAL_MORTGAGE_PREMIUM = Decimal("3000000.00")


class _FakeProvider:
    source = "open-finance"

    def __init__(self, score: str | None = None, error: Exception | None = None) -> None:
        self.score = score
        self.error = error
        self.calls = 0

    def risk_score(self, consent: OpenFinanceConsent) -> Decimal:
        self.calls += 1
        if self.error:
            raise self.error
        return Decimal(str(self.score))


class _BrokenCache:
    def get(self, key):
        raise ConnectionError("redis down")

    def set(self, key, value, ttl_s):
        raise ConnectionError("redis down")


@pytest.fixture(autouse=True)
def empty_stores():
    container.socios.socios.clear()
    container.configuraciones.configuraciones.clear()
    original = container.resolve_risk_profile
    yield
    container.resolve_risk_profile = original


def use_provider(provider, cache=None) -> None:
    container.resolve_risk_profile = ResolveRiskProfileUseCase(provider, cache or InMemoryCache(), ttl_s=60)


def partner_with(*lines: dict) -> dict:
    signup = {
        "nombre": "Banco Aurora",
        "identificador": "banco-aurora",
        "tipo": "Banco",
        "correo_contacto": "api@aurora.test",
        "alcances": ["cotizacion"],
        "autorizado_por": "Ana Gómez",
    }
    partner = client.post("/gobierno-socios/socios", json=signup).json()
    body = {"ramos": list(lines), "actualizado_por": "Ana Gómez"}
    assert client.put(f"/gobierno-socios/socios/{partner['id']}/configuracion", json=body).status_code == 200
    return partner


def travel(*coverages: str) -> dict:
    return {"ramo_id": "ramo-viaje", "coberturas": list(coverages)}


def mortgage(*coverages: str) -> dict:
    return {"ramo_id": "ramo-vida-hipotecario", "coberturas": list(coverages)}


def quote(partner: dict, body: dict, secret: str | None = None):
    headers = {"X-Client-Id": partner["client_id"], "X-Api-Key": secret or partner["secreto"]}
    return client.post("/gobierno-socios/cotizaciones", json=body, headers=headers)


def catalog(partner: dict, secret: str | None = None):
    headers = {"X-Client-Id": partner["client_id"], "X-Api-Key": secret or partner["secreto"]}
    return client.get("/gobierno-socios/catalogo", headers=headers)


# Criterio 1: prima y coberturas dentro del presupuesto de latencia.


def test_valid_request_returns_premium_and_enabled_coverages():
    partner = partner_with(travel("viaje-gastos-medicos", "viaje-asistencia"))

    response = quote(partner, TRAVEL)

    assert response.status_code == 200
    offer = response.json()
    assert Decimal(offer["prima"]) == Decimal("214200.00")
    assert [c["id"] for c in offer["coberturas"]] == ["viaje-gastos-medicos", "viaje-asistencia"]
    assert offer["canal"] == "socios"
    assert offer["degradada"] is False
    assert offer["senales"] == []


def test_stored_offer_keeps_only_partner_coverages():
    partner = partner_with(travel("viaje-equipaje"))

    offer = quote(partner, TRAVEL).json()

    stored = next(item for item in container.cotizaciones.items if item.id == offer["id"])
    assert [c.id for c in stored.coberturas] == ["viaje-equipaje"]


def test_in_process_p95_stays_under_400_ms():
    partner = partner_with(travel("viaje-gastos-medicos"))
    durations = []
    for _ in range(60):
        start = time.perf_counter()
        assert quote(partner, TRAVEL).status_code == 200
        durations.append((time.perf_counter() - start) * 1000)

    assert quantiles(durations, n=20)[18] < 400


def test_partner_lists_quotable_products_and_their_contract():
    partner = partner_with(mortgage("hipotecario-fallecimiento"), travel("viaje-asistencia"))

    response = catalog(partner)

    assert response.status_code == 200
    products = {p["producto_id"]: p for p in response.json()}
    assert list(products) == ["viaje-internacional", "vida-hipotecario"]
    assert products["viaje-internacional"]["ramo"] == {"id": "ramo-viaje", "nombre": "Viaje"}
    assert products["viaje-internacional"]["coberturas"] == [
        {"id": "viaje-asistencia", "nombre": "Asistencia en viaje"}
    ]
    contract = products["viaje-internacional"]["contrato"]
    assert set(contract["required"]) == {"producto_id", "destino", "fecha_salida", "fecha_regreso", "viajeros"}
    assert contract["properties"]["producto_id"]["const"] == "viaje-internacional"
    mortgage_contract = products["vida-hipotecario"]["contrato"]
    assert "consentimiento_open_finance" in mortgage_contract["properties"]
    assert "score_riesgo" not in mortgage_contract["properties"]


def test_catalog_skips_disabled_lines_and_untariffed_products():
    partner = partner_with({"ramo_id": "ramo-dispositivos", "coberturas": ["celular-robo"]})

    assert catalog(partner).json() == []


def test_published_contract_is_the_one_the_quote_validates():
    partner = partner_with(travel())
    contract = catalog(partner).json()[0]["contrato"]
    sample = {field: TRAVEL[field] for field in contract["required"]}

    assert quote(partner, sample).status_code == 200


def test_catalog_requires_valid_credentials():
    partner = partner_with(travel())

    assert catalog(partner, secret="otro").status_code == 401


# Criterio 2: error claro y sin cálculo.


def test_missing_required_field_reports_field_and_reason_without_quoting():
    partner = partner_with(travel())
    before = container.cotizaciones.count()
    incomplete = {k: v for k, v in TRAVEL.items() if k != "fecha_salida"}

    response = quote(partner, incomplete)

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "codigo": "datos_invalidos",
        "mensaje": "La solicitud tiene datos faltantes o inválidos. No se calculó la prima.",
        "campos": [{"campo": "fecha_salida", "error": "Campo obligatorio"}],
    }
    assert container.cotizaciones.count() == before


def test_out_of_contract_values_are_explained_in_spanish():
    partner = partner_with(travel())

    response = quote(partner, {**TRAVEL, "destino": "Marte", "viajeros": 0})

    fields = {c["campo"]: c["error"] for c in response.json()["detail"]["campos"]}
    assert response.status_code == 422
    assert fields["destino"].startswith("Valor no permitido. Opciones:")
    assert fields["viajeros"] == "Debe ser mayor o igual que 1"


def test_cross_field_rule_returns_business_message():
    partner = partner_with(travel())

    response = quote(partner, {**TRAVEL, "fecha_regreso": "2027-01-05"})

    assert response.status_code == 422
    assert response.json()["detail"]["campos"] == [
        {"campo": "solicitud", "error": "La fecha de regreso debe ser posterior a la fecha de salida"}
    ]


def test_missing_product_is_rejected_before_looking_up_the_line():
    partner = partner_with(travel())

    response = quote(partner, {"destino": "España"})

    assert response.status_code == 422
    assert response.json()["detail"]["campos"] == [{"campo": "producto_id", "error": "Campo obligatorio"}]


def test_disabled_line_returns_403_even_with_missing_fields():
    partner = partner_with(travel())

    response = quote(partner, {"producto_id": "vida-hipotecario"})

    assert response.status_code == 403
    assert response.json()["detail"]["codigo"] == "ramo_no_habilitado"


def test_invalid_credential_does_not_reveal_the_contract():
    partner = partner_with(travel())

    response = quote(partner, {"producto_id": "viaje-internacional"}, secret="otro")

    assert response.status_code == 401
    assert response.json()["detail"]["codigo"] == "credencial_invalida"


def test_partner_cannot_set_its_own_risk_score():
    partner = partner_with(mortgage())

    response = quote(partner, {**MORTGAGE, "score_riesgo": "0"})

    assert response.status_code == 200
    assert Decimal(response.json()["prima"]) == NEUTRAL_MORTGAGE_PREMIUM


def test_incomplete_consent_is_rejected():
    partner = partner_with(mortgage())

    response = quote(partner, {**MORTGAGE, "consentimiento_open_finance": {"referencia_cliente": "cliente-77"}})

    assert response.status_code == 422
    assert response.json()["detail"]["campos"] == [
        {"campo": "consentimiento_open_finance.consentimiento_id", "error": "Campo obligatorio"}
    ]


# Criterio 3: dependencia externa fuera de presupuesto → caché o valor por defecto, marcada como degradada.


def test_open_finance_score_enters_the_premium_with_consent():
    use_provider(_FakeProvider(score="0.7"))
    partner = partner_with(mortgage())

    offer = quote(partner, {**MORTGAGE, "consentimiento_open_finance": CONSENT}).json()

    assert Decimal(offer["prima"]) == Decimal("3360000.00")
    assert offer["degradada"] is False
    assert offer["senales"][0]["fuente"] == "open-finance"
    assert offer["senales"][0]["origen"] == "proveedor"
    assert Decimal(offer["senales"][0]["score_riesgo"]) == Decimal("0.7")


def test_provider_down_without_cache_uses_default_and_marks_degraded():
    use_provider(_FakeProvider(error=httpx.ReadTimeout("timeout")))
    partner = partner_with(mortgage())

    offer = quote(partner, {**MORTGAGE, "consentimiento_open_finance": CONSENT}).json()

    assert Decimal(offer["prima"]) == NEUTRAL_MORTGAGE_PREMIUM
    assert offer["degradada"] is True
    assert offer["senales"][0]["origen"] == "valor_por_defecto"
    stored = next(item for item in container.cotizaciones.items if item.id == offer["id"])
    assert stored.degradada is True
    assert stored.senales[0].origen is SignalOrigin.DEFAULT


def test_provider_down_with_cache_uses_last_known_good():
    provider = _FakeProvider(score="0.7")
    use_provider(provider)
    partner = partner_with(mortgage())
    body = {**MORTGAGE, "consentimiento_open_finance": CONSENT}
    quote(partner, body)

    provider.error = ConnectionError("circuit open")
    offer = quote(partner, body).json()

    assert Decimal(offer["prima"]) == Decimal("3360000.00")
    assert offer["degradada"] is True
    assert offer["senales"][0]["origen"] == "cache"


def test_broken_cache_does_not_break_the_quote():
    use_provider(_FakeProvider(error=TimeoutError()), cache=_BrokenCache())
    partner = partner_with(mortgage())

    response = quote(partner, {**MORTGAGE, "consentimiento_open_finance": CONSENT})

    assert response.status_code == 200
    assert response.json()["senales"][0]["origen"] == "valor_por_defecto"


def test_open_finance_is_not_called_without_consent():
    provider = _FakeProvider(score="0.7")
    use_provider(provider)
    partner = partner_with(mortgage())

    offer = quote(partner, MORTGAGE).json()

    assert provider.calls == 0
    assert offer["degradada"] is False
    assert Decimal(offer["prima"]) == NEUTRAL_MORTGAGE_PREMIUM


# Adaptador real: timeout duro, un solo intento y respuesta inválida tratada como falla.


@pytest.fixture
def open_finance():
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.server.calls += 1
            time.sleep(self.server.delay_s)
            payload = json.dumps(self.server.payload).encode()
            try:
                self.send_response(200)
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
    server.payload = {"score_riesgo": "0.62"}
    server.calls = 0
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield server
    server.shutdown()


def _resolver(server) -> ResolveRiskProfileUseCase:
    provider = build_provider(f"http://127.0.0.1:{server.server_port}", None, 0.3)
    return ResolveRiskProfileUseCase(provider, InMemoryCache(), ttl_s=60)


def test_real_adapter_answers_in_time(open_finance):
    signal = _resolver(open_finance).execute(OpenFinanceConsent(**CONSENT))

    assert signal.origen is SignalOrigin.PROVIDER
    assert signal.score_riesgo == Decimal("0.62")


def test_real_adapter_cuts_at_timeout_without_retrying(open_finance):
    open_finance.delay_s = 1.0
    resolver = _resolver(open_finance)

    start = time.perf_counter()
    signal = resolver.execute(OpenFinanceConsent(**CONSENT))
    elapsed = time.perf_counter() - start

    assert signal.origen is SignalOrigin.DEFAULT
    assert elapsed < 0.8
    assert open_finance.calls == 1


@pytest.mark.parametrize("payload", [{"score_riesgo": "1.5"}, {"score_riesgo": "alto"}, {"otro": 1}])
def test_invalid_open_finance_response_counts_as_failure(open_finance, payload):
    open_finance.payload = payload

    assert _resolver(open_finance).execute(OpenFinanceConsent(**CONSENT)).origen is SignalOrigin.DEFAULT


def test_adapter_takes_configured_timeout_and_does_not_retry():
    provider = build_provider("https://open-finance.test", None, 0.3)

    assert isinstance(provider, OpenFinanceRiskProfile)
    assert isinstance(provider.adapter, OpenFinanceQuoteAdapter)
    assert provider.adapter.retries == 0
    assert provider.adapter.client.timeout == httpx.Timeout(0.3)
    provider.adapter.client.close()


def test_without_url_the_deterministic_sandbox_answers():
    provider = build_provider(None, None, 0.3)
    consent = OpenFinanceConsent(**CONSENT)

    assert isinstance(provider, SandboxRiskProfile)
    assert provider.risk_score(consent) == provider.risk_score(consent)
    assert Decimal("0.30") <= provider.risk_score(consent) <= Decimal("0.70")


def test_timeout_cannot_exceed_the_3000_ms_ceiling():
    with pytest.raises(ValidationError):
        CotizacionSettings(open_finance_timeout_s=3.5)


# HU015: la cotización recuerda al socio y otros servicios lo autorizan por alcance.


def test_partner_quote_records_the_partner():
    partner = partner_with(travel())

    offer = quote(partner, TRAVEL).json()

    stored = next(item for item in container.cotizaciones.items if item.id == offer["id"])
    assert stored.socio_id == partner["id"]
    assert client.get(f"/consenso/cotizaciones/{offer['id']}").json()["socio_id"] == partner["id"]


def _authorize(partner: dict, scope: str, secret: str | None = None):
    headers = {"X-Client-Id": partner["client_id"], "X-Api-Key": secret or partner["secreto"]}
    return client.get("/gobierno-socios/autorizacion", params={"alcance": scope}, headers=headers)


def test_authorization_returns_the_partner_for_a_granted_scope():
    partner = partner_with(travel())

    response = _authorize(partner, "cotizacion")

    assert response.status_code == 200
    assert response.json() == {"socio_id": partner["id"], "identificador": "BANCO-AURORA", "nombre": "Banco Aurora"}


def test_authorization_rejects_a_scope_not_granted():
    partner = partner_with(travel())

    response = _authorize(partner, "emision")

    assert response.status_code == 403
    assert response.json()["detail"]["codigo"] == "alcance_no_autorizado"


def test_authorization_rejects_invalid_credentials():
    partner = partner_with(travel())

    assert _authorize(partner, "cotizacion", secret="otro").status_code == 401
