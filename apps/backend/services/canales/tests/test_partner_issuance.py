"""HU015: el socio paga su cotización y emite la póliza desde la API pública."""

import httpx
from canales.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

HEADERS = {"X-Client-Id": "sv_live_aurora_ab12", "X-Api-Key": "sv_sec_demo", "Idempotency-Key": "pedido-77"}
PARTNER = {"socio_id": "socio-1", "identificador": "BANCO-AURORA", "nombre": "Banco Aurora"}
QUOTE = {
    "id": "cot-1",
    "prima": "214200.00",
    "vigente_hasta": "2099-01-01T23:59:59-05:00",
    "socio_id": "socio-1",
}
PAYMENT = {"id": "cobro-1", "cotizacion_id": "cot-1", "estado": "aprobado", "monto": "214200.00", "moneda": "COP"}
POLICY = {
    "id": "pol-1",
    "numero": "POL-ABC123",
    "estado": "activa",
    "cotizacion_id": "cot-1",
    "producto_id": "viaje-internacional",
    "prima": "214200.00",
    "coberturas": [{"id": "viaje-asistencia", "nombre": "Asistencia en viaje"}],
    "vigencia": {"desde": "2027-01-10", "hasta": "2027-01-20"},
    "idempotency_key": "socios:socio-1:pedido-77",
    "socio_id": "socio-1",
}


class _Upstream:
    def __init__(self, responses: dict | None = None, error: Exception | None = None) -> None:
        self.responses = responses or {}
        self.error = error
        self.calls: list[tuple[str, dict]] = []

    def _answer(self, path: str, **kwargs):
        self.calls.append((path, kwargs))
        if self.error:
            raise self.error
        return next(value for prefix, value in self.responses.items() if path.startswith(prefix))

    get = _answer
    post = _answer


def _http_error(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://upstream")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


def _quotes(quote: dict = QUOTE) -> _Upstream:
    return _Upstream({"/gobierno-socios/autorizacion": PARTNER, "/consenso/cotizaciones/": quote})


def test_partner_pays_with_the_server_premium_and_a_scoped_key(monkeypatch):
    payments = _Upstream({"/pagos/cobros": PAYMENT})
    quotes = _quotes()
    monkeypatch.setattr("canales.socios.api.cotizacion", quotes)
    monkeypatch.setattr("canales.socios.api.pagos", payments)

    response = client.post("/socios/v1/cotizaciones/cot-1/pagos", json={"medio_token": "demo-4242"}, headers=HEADERS)

    assert response.status_code == 200
    assert response.json() == PAYMENT
    assert quotes.calls[0][1]["params"] == {"alcance": "emision"}
    sent = payments.calls[0][1]["json"]
    assert sent["monto"] == "214200.00"
    assert sent["idempotency_key"] == "socios:socio-1:pedido-77"
    assert sent["cliente_id"] == "socio:socio-1"
    assert sent["medio_token"] == "demo-4242"


def test_partner_cannot_pay_another_partner_quote(monkeypatch):
    payments = _Upstream({"/pagos/cobros": PAYMENT})
    monkeypatch.setattr("canales.socios.api.cotizacion", _quotes(QUOTE | {"socio_id": "otro"}))
    monkeypatch.setattr("canales.socios.api.pagos", payments)

    response = client.post("/socios/v1/cotizaciones/cot-1/pagos", json={"medio_token": "demo-4242"}, headers=HEADERS)

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "cotizacion_no_encontrada"
    assert payments.calls == []


def test_expired_quote_is_not_charged(monkeypatch):
    payments = _Upstream({"/pagos/cobros": PAYMENT})
    monkeypatch.setattr(
        "canales.socios.api.cotizacion", _quotes(QUOTE | {"vigente_hasta": "2000-01-01T23:59:59-05:00"})
    )
    monkeypatch.setattr("canales.socios.api.pagos", payments)

    response = client.post("/socios/v1/cotizaciones/cot-1/pagos", json={"medio_token": "demo-4242"}, headers=HEADERS)

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "cotizacion_vencida"
    assert payments.calls == []


def test_partner_issues_policy_with_scoped_key(monkeypatch):
    policies = _Upstream({"/polizas/emisiones": POLICY})
    monkeypatch.setattr("canales.socios.api.cotizacion", _quotes())
    monkeypatch.setattr("canales.socios.api.polizas", policies)

    response = client.post(
        "/socios/v1/polizas", json={"cotizacion_id": "cot-1", "cobro_id": "cobro-1"}, headers=HEADERS
    )

    assert response.status_code == 201
    assert response.json()["numero"] == "POL-ABC123"
    assert response.json()["vigencia"] == {"desde": "2027-01-10", "hasta": "2027-01-20"}
    assert "idempotency_key" not in response.json()
    assert "socio_id" not in response.json()
    sent = policies.calls[0][1]["json"]
    assert sent == {
        "cotizacion_id": "cot-1",
        "cobro_id": "cobro-1",
        "idempotency_key": "socios:socio-1:pedido-77",
        "canal": "socios",
        "socio_id": "socio-1",
    }


def test_issuance_keeps_the_business_error(monkeypatch):
    detail = {"codigo": "pago_no_aprobado", "mensaje": "El pago no está aprobado para esta cotización."}
    monkeypatch.setattr("canales.socios.api.cotizacion", _quotes())
    monkeypatch.setattr("canales.socios.api.polizas", _Upstream(error=_http_error(409, detail)))

    response = client.post(
        "/socios/v1/polizas", json={"cotizacion_id": "cot-1", "cobro_id": "cobro-1"}, headers=HEADERS
    )

    assert response.status_code == 409
    assert response.json()["detail"] == detail


def test_scope_without_issuance_is_rejected_before_issuing(monkeypatch):
    detail = {"codigo": "alcance_no_autorizado", "mensaje": "El alcance del socio no incluye la operación 'emision'."}
    policies = _Upstream({"/polizas/emisiones": POLICY})
    monkeypatch.setattr("canales.socios.api.cotizacion", _Upstream(error=_http_error(403, detail)))
    monkeypatch.setattr("canales.socios.api.polizas", policies)

    response = client.post(
        "/socios/v1/polizas", json={"cotizacion_id": "cot-1", "cobro_id": "cobro-1"}, headers=HEADERS
    )

    assert response.status_code == 403
    assert response.json()["detail"] == detail
    assert policies.calls == []


def test_idempotency_key_is_required():
    headers = {k: v for k, v in HEADERS.items() if k != "Idempotency-Key"}

    assert (
        client.post("/socios/v1/polizas", json={"cotizacion_id": "c", "cobro_id": "p"}, headers=headers).status_code
        == 422
    )
    assert client.post("/socios/v1/cotizaciones/c/pagos", json={"medio_token": "t"}, headers=headers).status_code == 422
