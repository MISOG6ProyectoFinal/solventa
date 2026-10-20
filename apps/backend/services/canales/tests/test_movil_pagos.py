"""Pago móvil de una cotización: sesión, monto del servidor, vigencia e idempotencia."""

import httpx
from canales.main import app
from fastapi.testclient import TestClient

from tests.movil_auth import authorization

client = TestClient(app)

VIGENTE = {
    "id": "oferta-1",
    "producto_id": "viaje-internacional",
    "prima": "149940.00",
    "vigente_hasta": "2099-01-01T23:59:59-05:00",
}

VENCIDA = {**VIGENTE, "vigente_hasta": "2000-01-01T23:59:59-05:00"}

COBRO = {
    "id": "cobro-1",
    "cotizacion_id": "oferta-1",
    "estado": "aprobado",
    "monto": "149940.00",
    "moneda": "COP",
}


class _Upstream:
    def __init__(self, response=None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[tuple[str, dict]] = []

    def _next_response(self, path: str, **kwargs):
        self.calls.append((path, kwargs))
        if self.error:
            raise self.error
        return self.response

    def get(self, path: str, **kwargs):
        return self._next_response(path, **kwargs)

    def post(self, path: str, **kwargs):
        return self._next_response(path, **kwargs)


def _error_json(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("GET", "https://cotizacion/consenso/cotizaciones/oferta-1")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


def _pagar(body: dict | None = None, headers: dict | None = None):
    return client.post("/movil/cotizaciones/oferta-1/pagos", json=body if body is not None else {}, headers=headers)


def test_pagar_exige_sesion():
    response = _pagar()
    assert response.status_code == 401
    assert response.json()["detail"] == "La sesión no es válida"


def test_consulta_la_cotizacion_y_no_usa_el_monto_del_cliente(monkeypatch):
    cotizaciones = _Upstream(response=VIGENTE)
    cobros = _Upstream(response=COBRO)
    monkeypatch.setattr("canales.movil.api.cotizacion", cotizaciones)
    monkeypatch.setattr("canales.movil.api.pagos", cobros)

    response = _pagar({"monto": "1.00", "moneda": "USD"}, authorization())

    assert response.status_code == 200
    assert response.json()["estado"] == "aprobado"
    assert response.json()["monto"] == "149940.00"
    assert cotizaciones.calls[0][0] == "/consenso/cotizaciones/oferta-1"
    enviado = cobros.calls[0][1]["json"]
    assert enviado["monto"] == "149940.00"
    assert enviado["monto"] != "1.00"
    assert "USD" not in enviado.values()
    assert enviado["idempotency_key"] == "movil:cliente-demo:oferta-1"
    assert enviado["cliente_id"] == "cliente-demo"
    assert enviado["medio_token"] == "demo-4242"


def test_cotizacion_vencida_no_invoca_pagos(monkeypatch):
    cobros = _Upstream(response=COBRO)
    monkeypatch.setattr("canales.movil.api.cotizacion", _Upstream(response=VENCIDA))
    monkeypatch.setattr("canales.movil.api.pagos", cobros)

    response = _pagar({"simulacion": "rechazado"}, authorization())

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "cotizacion_vencida"
    assert response.json()["detail"]["mensaje"].startswith("Esta cotización ya no está vigente")
    assert cobros.calls == []


def test_cotizacion_vigente_invoca_pagos(monkeypatch):
    cobros = _Upstream(response=COBRO)
    monkeypatch.setattr("canales.movil.api.cotizacion", _Upstream(response=VIGENTE))
    monkeypatch.setattr("canales.movil.api.pagos", cobros)

    response = _pagar({}, authorization())

    assert response.status_code == 200
    assert cobros.calls[0][0] == "/pagos/cobros"
    assert cobros.calls[0][1]["json"]["cotizacion_id"] == "oferta-1"


def test_simular_vencida_no_invoca_pagos_aunque_la_oferta_siga_vigente(monkeypatch):
    cobros = _Upstream(response=COBRO)
    monkeypatch.setattr("canales.movil.api.cotizacion", _Upstream(response=VIGENTE))
    monkeypatch.setattr("canales.movil.api.pagos", cobros)

    response = _pagar({"simulacion": "vencida"}, authorization())

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "cotizacion_vencida"
    assert cobros.calls == []


def test_simular_rechazo_pide_el_alias_de_prototipo(monkeypatch):
    cobros = _Upstream(response={**COBRO, "estado": "rechazado"})
    monkeypatch.setattr("canales.movil.api.cotizacion", _Upstream(response=VIGENTE))
    monkeypatch.setattr("canales.movil.api.pagos", cobros)

    response = _pagar({"simulacion": "rechazado"}, authorization())

    assert response.status_code == 200
    assert response.json()["estado"] == "rechazado"
    assert cobros.calls[0][1]["json"]["medio_token"] == "demo-rechazo"


def test_conserva_el_error_estructurado_de_cotizacion(monkeypatch):
    detalle = {"codigo": "cotizacion_no_encontrada", "mensaje": "Cotización no encontrada: oferta-1"}
    cobros = _Upstream(response=COBRO)
    monkeypatch.setattr("canales.movil.api.cotizacion", _Upstream(error=_error_json(404, detalle)))
    monkeypatch.setattr("canales.movil.api.pagos", cobros)

    response = _pagar({}, authorization())

    assert response.status_code == 404
    assert response.json()["detail"] == detalle
    assert cobros.calls == []


def test_conserva_el_error_estructurado_de_pagos(monkeypatch):
    detalle = {"codigo": "pasarela_no_disponible", "mensaje": "Pasarela de pagos no disponible"}
    monkeypatch.setattr("canales.movil.api.cotizacion", _Upstream(response=VIGENTE))
    monkeypatch.setattr("canales.movil.api.pagos", _Upstream(error=_error_json(503, detalle)))

    response = _pagar({}, authorization())

    assert response.status_code == 503
    assert response.json()["detail"] == detalle
