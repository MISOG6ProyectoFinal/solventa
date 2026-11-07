"""HU016: el socio consulta el estado de sus pólizas y siniestros desde la API pública."""

import httpx
import pytest
from canales.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

HEADERS = {"X-Client-Id": "sv_live_aurora_ab12", "X-Api-Key": "sv_sec_demo"}
PARTNER = {"socio_id": "socio-1", "identificador": "BANCO-AURORA", "nombre": "Banco Aurora"}
POLICY = {
    "id": "pol-1",
    "numero": "POL-ABC123",
    "estado": "vencida",
    "cotizacion_id": "cot-1",
    "cobro_id": "cobro-1",
    "producto_id": "viaje-internacional",
    "prima": "214200.00",
    "coberturas": [{"id": "viaje-asistencia", "nombre": "Asistencia en viaje"}],
    "vigencia": {"desde": "2026-01-10", "hasta": "2026-01-20"},
    "idempotency_key": "socios:socio-1:pedido-77",
    "socio_id": "socio-1",
    "cliente_id": None,
}
CLAIM = {
    "id": "aviso-1",
    "cliente_id": "cliente-9",
    "poliza_id": "pol-1",
    "tipo": "Robo",
    "ocurrido_en": "2026-10-20T15:00:00Z",
    "descripcion": "Me robaron el equipaje en el aeropuerto.",
    "ubicacion": "Bogotá",
    "estado": "radicado",
    "radicado": "SIN-12345",
}


def _http_error(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("GET", "https://upstream")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


NOT_FOUND = {"codigo": "no_encontrado", "mensaje": "No existe."}


class _Upstream:
    def __init__(self, answer=None) -> None:
        self.answer = answer
        self.calls: list[str] = []

    def get(self, path: str, **kwargs):
        self.calls.append(path)
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer


@pytest.fixture
def services(monkeypatch):
    def wire(partner=PARTNER, policy=POLICY, claim=CLAIM):
        upstreams = {"cotizacion": _Upstream(partner), "polizas": _Upstream(policy), "siniestros": _Upstream(claim)}
        for name, upstream in upstreams.items():
            monkeypatch.setattr(f"canales.socios.api.{name}", upstream)
        return upstreams

    return wire


# Criterio 1: identificador válido dentro del alcance.


def test_partner_reads_its_policy_with_the_current_status_and_main_data(services):
    upstreams = services()

    response = client.get("/socios/v1/polizas/pol-1", headers=HEADERS)

    assert response.status_code == 200
    assert response.json() == {
        "id": "pol-1",
        "numero": "POL-ABC123",
        "estado": "vencida",
        "cotizacion_id": "cot-1",
        "producto_id": "viaje-internacional",
        "prima": "214200.00",
        "coberturas": [{"id": "viaje-asistencia", "nombre": "Asistencia en viaje"}],
        "vigencia": {"desde": "2026-01-10", "hasta": "2026-01-20"},
    }
    assert upstreams["polizas"].calls == ["/polizas/pol-1"]


def test_partner_reads_a_claim_of_its_policy_without_personal_data(services):
    services()

    response = client.get("/socios/v1/siniestros/aviso-1", headers=HEADERS)

    assert response.status_code == 200
    assert response.json() == {
        "id": "aviso-1",
        "radicado": "SIN-12345",
        "estado": "radicado",
        "poliza_id": "pol-1",
        "tipo": "Robo",
        "ocurrido_en": "2026-10-20T15:00:00Z",
    }


def test_lookup_asks_for_the_consulta_scope(services, monkeypatch):
    seen: dict = {}

    class _Governance:
        def get(self, path, **kwargs):
            seen.update(path=path, **kwargs)
            return PARTNER

    services()
    monkeypatch.setattr("canales.socios.api.cotizacion", _Governance())

    client.get("/socios/v1/polizas/pol-1", headers=HEADERS)

    assert seen["path"] == "/gobierno-socios/autorizacion"
    assert seen["params"] == {"alcance": "consulta"}
    assert seen["headers"] == {"X-Client-Id": HEADERS["X-Client-Id"], "X-Api-Key": HEADERS["X-Api-Key"]}


# Criterio 2: recurso fuera del alcance → error de autorización, sin datos.


@pytest.mark.parametrize("url", ["/socios/v1/polizas/pol-1", "/socios/v1/siniestros/aviso-1"])
@pytest.mark.parametrize("owner", ["socio-2", None])
def test_resource_of_someone_else_is_forbidden_and_exposes_nothing(services, url, owner):
    services(policy={**POLICY, "socio_id": owner})

    response = client.get(url, headers=HEADERS)

    assert response.status_code == 403
    assert response.json()["detail"]["codigo"] == "recurso_fuera_de_alcance"
    assert "POL-ABC123" not in response.text
    assert "SIN-12345" not in response.text


def test_claim_whose_policy_does_not_exist_is_out_of_scope(services):
    services(policy=_http_error(404, NOT_FOUND))

    response = client.get("/socios/v1/siniestros/aviso-1", headers=HEADERS)

    assert response.status_code == 403
    assert response.json()["detail"]["codigo"] == "recurso_fuera_de_alcance"


@pytest.mark.parametrize("url", ["/socios/v1/polizas/pol-1", "/socios/v1/siniestros/aviso-1"])
def test_partner_without_the_scope_never_reaches_the_resource(services, url):
    denied = {"codigo": "alcance_no_autorizado", "mensaje": "El alcance del socio no incluye la operación."}
    upstreams = services(partner=_http_error(403, denied))

    response = client.get(url, headers=HEADERS)

    assert response.status_code == 403
    assert response.json()["detail"]["codigo"] == "alcance_no_autorizado"
    assert upstreams["polizas"].calls == []
    assert upstreams["siniestros"].calls == []


# Criterio 3: identificador inexistente → no encontrado explícito.


def test_unknown_policy_is_an_explicit_not_found(services):
    detail = {"codigo": "poliza_no_encontrada", "mensaje": "La póliza no existe."}
    services(policy=_http_error(404, detail))

    response = client.get("/socios/v1/polizas/no-existe", headers=HEADERS)

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "poliza_no_encontrada"


def test_unknown_claim_is_an_explicit_not_found(services):
    detail = {"codigo": "siniestro_no_encontrado", "mensaje": "El siniestro no existe."}
    upstreams = services(claim=_http_error(404, detail))

    response = client.get("/socios/v1/siniestros/no-existe", headers=HEADERS)

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "siniestro_no_encontrado"
    assert upstreams["polizas"].calls == []


def test_malformed_identifier_does_not_reach_the_services(services):
    upstreams = services()

    response = client.get("/socios/v1/polizas/pol%20con%20espacios", headers=HEADERS)

    assert response.status_code == 422
    assert upstreams["polizas"].calls == []


def test_policy_service_down_while_checking_a_claim_is_not_reported_as_forbidden(services):
    request = httpx.Request("GET", "https://upstream")
    services(policy=httpx.ConnectError("sin conexión", request=request))

    response = client.get("/socios/v1/siniestros/aviso-1", headers=HEADERS)

    assert response.status_code == 503


def test_claim_policy_id_is_escaped_before_calling_policies(services):
    upstreams = services(claim={**CLAIM, "poliza_id": "../otra"})

    client.get("/socios/v1/siniestros/aviso-1", headers=HEADERS)

    assert upstreams["polizas"].calls == ["/polizas/..%2Fotra"]
