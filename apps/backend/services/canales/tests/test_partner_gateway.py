"""HU017: el gateway de socios valida alcance, cuota y versión de contrato en cada llamada."""

import httpx
import pytest
from canales.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

HEADERS = {"X-Client-Id": "sv_live_aurora_ab12", "X-Api-Key": "sv_sec_demo"}
USAGE = {"cuota_consumo": 100, "consumidas": 40, "reinicia_en_s": 20, "permitido": True}
PARTNER = {"socio_id": "socio-1", "identificador": "BANCO-AURORA", "nombre": "Banco Aurora", "consumo": USAGE}
POLICY = {
    "id": "pol-1",
    "numero": "POL-ABC123",
    "estado": "activa",
    "cotizacion_id": "cot-1",
    "producto_id": "viaje-internacional",
    "prima": "214200.00",
    "coberturas": [],
    "vigencia": {"desde": "2027-01-10", "hasta": "2027-01-20"},
    "socio_id": "socio-1",
}


def _http_error(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("GET", "https://upstream")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


class _Service:
    def __init__(self, answer=None) -> None:
        self.answer = answer
        self.calls: list[str] = []

    def _call(self, path: str, **_kwargs):
        self.calls.append(path)
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer(path) if callable(self.answer) else self.answer

    get = _call
    post = _call


@pytest.fixture
def core(monkeypatch):
    services = {"polizas": _Service(POLICY), "pagos": _Service({}), "siniestros": _Service({})}
    for name, service in services.items():
        monkeypatch.setattr(f"canales.socios.api.{name}", service)
    return services


def governance(monkeypatch, answer) -> _Service:
    service = _Service(answer)
    monkeypatch.setattr("canales.socios.api.cotizacion", service)
    return service


def test_a_call_outside_the_partner_scope_never_reaches_the_service(monkeypatch, core):
    denied = {"codigo": "alcance_no_autorizado", "mensaje": "El alcance del socio no incluye la operación 'emision'."}
    gateway = governance(monkeypatch, _http_error(403, denied))

    response = client.post(
        "/socios/v1/polizas",
        json={"cotizacion_id": "cot-1", "cobro_id": "cobro-1"},
        headers=HEADERS | {"Idempotency-Key": "pedido-1"},
    )

    assert response.status_code == 403
    assert response.json()["detail"]["codigo"] == "alcance_no_autorizado"
    assert gateway.calls == ["/gobierno-socios/autorizacion"]
    assert core["polizas"].calls == []


def test_quoting_routes_also_pass_through_the_gateway(monkeypatch):
    denied = {"codigo": "alcance_no_autorizado", "mensaje": "Sin alcance de cotización."}
    gateway = governance(monkeypatch, _http_error(403, denied))

    assert client.get("/socios/v1/productos", headers=HEADERS).status_code == 403
    assert client.post("/socios/v1/cotizaciones", json={}, headers=HEADERS).status_code == 403
    assert gateway.calls == ["/gobierno-socios/autorizacion", "/gobierno-socios/autorizacion"]


def test_a_partner_over_its_quota_gets_429_and_the_service_is_not_called(monkeypatch, core):
    exhausted = USAGE | {"consumidas": 101, "permitido": False}
    governance(monkeypatch, PARTNER | {"consumo": exhausted})

    response = client.get("/socios/v1/polizas/pol-1", headers=HEADERS)

    assert response.status_code == 429
    assert response.json()["detail"]["codigo"] == "cuota_excedida"
    assert response.headers["Retry-After"] == "20"
    assert response.headers["X-RateLimit-Remaining"] == "0"
    assert core["polizas"].calls == []


def test_the_quota_of_one_partner_does_not_affect_another(monkeypatch, core):
    exhausted = USAGE | {"consumidas": 101, "permitido": False}

    def by_partner(_path: str) -> dict:
        return PARTNER | {"consumo": exhausted} if state["caller"] == "busy" else PARTNER

    state = {"caller": "busy"}
    governance(monkeypatch, by_partner)
    assert client.get("/socios/v1/polizas/pol-1", headers=HEADERS).status_code == 429

    state["caller"] = "quiet"
    response = client.get("/socios/v1/polizas/pol-1", headers=HEADERS)

    assert response.status_code == 200
    assert response.headers["X-RateLimit-Limit"] == "100"
    assert response.headers["X-RateLimit-Remaining"] == "60"
    assert response.headers["X-RateLimit-Reset"] == "20"


def test_a_partner_without_usage_data_is_still_served(monkeypatch, core):
    governance(monkeypatch, {key: PARTNER[key] for key in ("socio_id", "identificador", "nombre")})

    response = client.get("/socios/v1/polizas/pol-1", headers=HEADERS)

    assert response.status_code == 200
    assert "X-RateLimit-Limit" not in response.headers


def test_a_missing_idempotency_key_is_rejected_before_counting_the_call(monkeypatch, core):
    gateway = governance(monkeypatch, PARTNER)

    response = client.post("/socios/v1/polizas", json={"cotizacion_id": "c", "cobro_id": "p"}, headers=HEADERS)

    assert response.status_code == 422
    assert gateway.calls == []


def test_the_declared_contract_version_routes_to_that_version(monkeypatch, core):
    governance(monkeypatch, PARTNER)

    response = client.get("/socios/polizas/pol-1", headers=HEADERS | {"X-Api-Version": "v1"})

    assert response.status_code == 200
    assert response.json()["numero"] == "POL-ABC123"
    assert core["polizas"].calls == ["/polizas/pol-1"]


def test_an_unknown_contract_version_is_rejected_with_the_available_ones(monkeypatch, core):
    gateway = governance(monkeypatch, PARTNER)

    response = client.get("/socios/polizas/pol-1", headers=HEADERS | {"X-Api-Version": "v9"})

    assert response.status_code == 400
    assert response.json()["detail"] == {
        "codigo": "version_no_soportada",
        "mensaje": "La versión 'v9' del contrato no está disponible.",
        "versiones": ["v1"],
    }
    assert gateway.calls == []


def test_a_versioned_path_and_the_root_keep_working(monkeypatch, core):
    governance(monkeypatch, PARTNER)

    assert client.get("/socios/v1/polizas/pol-1", headers=HEADERS | {"X-Api-Version": "v1"}).status_code == 200
    assert client.get("/socios/", headers={"X-Api-Version": "v1"}).json()["versiones"] == ["v1"]
    assert client.get("/socios/polizas/pol-1", headers=HEADERS).status_code == 404
