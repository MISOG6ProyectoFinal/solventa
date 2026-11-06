"""Consulta de pólizas del portal: la póliza con los datos de los demás servicios."""

import httpx
from canales.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

POLICY = {
    "id": "pol-1",
    "numero": "POL-ABC",
    "estado": "activa",
    "cotizacion_id": "COT-1",
    "cobro_id": "cobro-1",
    "producto_id": "vida-hipotecario",
    "prima": "3927000.00",
    "coberturas": [{"id": "hip-1", "nombre": "Fallecimiento"}],
    "vigencia": {"desde": "2026-11-05", "hasta": "2041-11-05"},
    "canal": "mobile",
    "cliente_id": "CLI-CC-1020",
    "socio_id": None,
}
PARTNER_POLICY = {**POLICY, "id": "pol-2", "canal": "socios", "cliente_id": None, "socio_id": "socio-1"}


def _missing(path: str) -> httpx.HTTPStatusError:
    request = httpx.Request("GET", f"https://interno{path}")
    return httpx.HTTPStatusError("404", request=request, response=httpx.Response(404, request=request))


class _Service:
    def __init__(self, responses: dict[str, object]) -> None:
        self.responses = responses
        self.calls: list[str] = []

    def get(self, path: str, **kwargs):
        self.calls.append(path)
        if path not in self.responses:
            raise _missing(path)
        return self.responses[path]


def _wire(monkeypatch, polizas: dict) -> dict[str, _Service]:
    services = {
        "polizas": _Service(polizas),
        "identidad": _Service(
            {
                "/identidad/clientes/CLI-CC-1020": {
                    "id": "CLI-CC-1020",
                    "tipo_documento": "CC",
                    "numero_documento": "1020",
                    "nombre": "Lina",
                    "apellido": "Díaz",
                    "email": "lina@solventa.test",
                    "telefono": "3001234567",
                    "pais": "Colombia",
                }
            }
        ),
        "cotizacion": _Service(
            {
                "/gobierno-socios/socios/socio-1": {"id": "socio-1", "nombre": "Banco Aurora", "secreto": "no"},
                "/catalogo/productos/vida-hipotecario": {
                    "id": "vida-hipotecario",
                    "nombre": "Vida Hipotecario",
                    "ramo_id": "ramo-vida-hipotecario",
                },
            }
        ),
        "pagos": _Service({"/pagos/cobros/cobro-1": {"id": "cobro-1", "estado": "aprobado", "monto": "3927000.00"}}),
        "siniestros": _Service({"/siniestros/polizas/pol-1/avisos": [{"id": "aviso-1", "estado": "radicado"}]}),
    }
    for name, service in services.items():
        monkeypatch.setattr(f"canales.web.policies.{name}", service)
    return services


def test_lists_recent_policies_with_customer_partner_and_line(monkeypatch):
    services = _wire(monkeypatch, {"/polizas/recientes": [POLICY, PARTNER_POLICY]})

    response = client.get("/web/polizas")

    assert response.status_code == 200
    mobile, partner = response.json()
    assert mobile["cliente"] == {
        "tipo_documento": "CC",
        "numero_documento": "1020",
        "nombre": "Lina",
        "apellido": "Díaz",
        "email": "lina@solventa.test",
        "telefono": "3001234567",
    }
    assert mobile["ramo_id"] == "ramo-vida-hipotecario"
    assert mobile["producto"] == {"id": "vida-hipotecario", "nombre": "Vida Hipotecario"}
    assert mobile["socio"] is None
    assert partner["socio"] == {"id": "socio-1", "nombre": "Banco Aurora"}
    assert partner["cliente"] is None
    assert services["cotizacion"].calls.count("/catalogo/productos/vida-hipotecario") == 1


def test_detail_adds_payments_and_claims(monkeypatch):
    _wire(monkeypatch, {"/polizas/pol-1": POLICY})

    response = client.get("/web/polizas/pol-1")

    assert response.status_code == 200
    assert response.json()["pagos"] == [{"id": "cobro-1", "estado": "aprobado", "monto": "3927000.00"}]
    assert response.json()["siniestros"] == [{"id": "aviso-1", "estado": "radicado"}]


def test_missing_data_in_other_services_does_not_hide_the_policy(monkeypatch):
    services = _wire(monkeypatch, {"/polizas/pol-2": {**PARTNER_POLICY, "producto_id": "otro"}})
    services["pagos"].responses.clear()

    response = client.get("/web/polizas/pol-2")

    assert response.status_code == 200
    assert response.json()["producto"] is None
    assert response.json()["ramo_id"] is None
    assert response.json()["pagos"] == []
    assert response.json()["siniestros"] == []


def test_unknown_policy_keeps_the_404(monkeypatch):
    _wire(monkeypatch, {})

    assert client.get("/web/polizas/no-existe").status_code == 404


class _Upstream:
    def __init__(self, response) -> None:
        self.response = response
        self.calls: list[tuple[str, dict]] = []

    def get(self, path: str, **kwargs):
        self.calls.append((path, kwargs))
        return self.response

    post = get


def test_mortgage_quote_carries_the_open_finance_consent_the_customer_granted(monkeypatch):
    consent = {
        "consentimiento_id": "CNS-1",
        "cliente_id": "CLI-CC-1020",
        "estado": "OTORGADO",
        "alcance_lista": ["Open Finance", "Open Data"],
    }
    cotizacion = _Upstream({"id": "COT-1", "prima": "3927000.00"})
    monkeypatch.setattr("canales.web.api.identidad", _Upstream(consent))
    monkeypatch.setattr("canales.web.api.cotizacion", cotizacion)

    response = client.post("/web/cotizaciones", json={"producto_id": "vida-hipotecario", "consentimiento_id": "CNS-1"})

    assert response.status_code == 200
    assert cotizacion.calls[0][1]["json"]["consentimiento_open_finance"] == {
        "referencia_cliente": "CLI-CC-1020",
        "consentimiento_id": "CNS-1",
    }


def test_consent_without_open_finance_does_not_send_it(monkeypatch):
    consent = {
        "consentimiento_id": "CNS-2",
        "cliente_id": "CLI-1",
        "estado": "OTORGADO",
        "alcance_lista": ["Open Data"],
    }
    cotizacion = _Upstream({"id": "COT-2", "prima": "3927000.00"})
    monkeypatch.setattr("canales.web.api.identidad", _Upstream(consent))
    monkeypatch.setattr("canales.web.api.cotizacion", cotizacion)

    client.post("/web/cotizaciones", json={"producto_id": "vida-hipotecario", "consentimiento_id": "CNS-2"})

    assert "consentimiento_open_finance" not in cotizacion.calls[0][1]["json"]
