"""Pago de renovación: sesión, monto de la oferta, ciclo e inmutabilidad de la póliza."""

import httpx
from canales.main import app
from fastapi.testclient import TestClient

from tests.movil_auth import authorization

client = TestClient(app)

OFERTA = {
    "poliza_id": "poliza-1",
    "numero_poliza": "POL-1",
    "producto_id": "viaje-internacional",
    "prima_actual": "100.00",
    "prima_propuesta": "123456.78",
    "vigencia_actual": {"desde": "2026-10-10", "hasta": "2026-10-24"},
    "vigencia_propuesta": {"desde": "2026-10-25", "hasta": "2026-11-08"},
    "coberturas_propuestas": [],
}

CICLO = "poliza-1:2026-10-25:2026-11-08"

COBRO = {
    "id": "cobro-renovacion",
    "tipo_referencia": "renovacion",
    "referencia_id": CICLO,
    "cotizacion_id": None,
    "estado": "aprobado",
    "monto": "123456.78",
    "moneda": "COP",
}


class _Servicio:
    def __init__(self, response=None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[tuple] = []

    def _call(self, method: str, path: str, **kwargs):
        self.calls.append((method, path, kwargs))
        if self.error:
            raise self.error
        return self.response

    def get(self, path: str, **kwargs):
        return self._call("GET", path, **kwargs)

    def post(self, path: str, **kwargs):
        return self._call("POST", path, **kwargs)

    def put(self, path: str, **kwargs):
        return self._call("PUT", path, **kwargs)

    def patch(self, path: str, **kwargs):
        return self._call("PATCH", path, **kwargs)


def _error(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("GET", "https://polizas/polizas/poliza-1/renovacion/oferta")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


def _pagar(body: dict | None = None, headers: dict | None = None):
    payload = {"intento_id": "intento-1"}
    if body:
        payload.update(body)
    return client.post("/movil/polizas/poliza-1/renovacion/pagos", json=payload, headers=headers)


def _mutaciones(servicio: _Servicio) -> list[tuple]:
    return [llamada for llamada in servicio.calls if llamada[0] != "GET"]


def test_pagar_renovacion_exige_sesion():
    response = _pagar()

    assert response.status_code == 401
    assert response.json()["detail"] == "La sesión no es válida"


def test_no_cobra_si_la_poliza_no_existe_o_no_es_renovable(monkeypatch):
    for status, codigo in ((404, "poliza_no_encontrada"), (409, "poliza_no_renovable")):
        detalle = {"codigo": codigo, "mensaje": "No se cobra."}
        polizas = _Servicio(error=_error(status, detalle))
        cobros = _Servicio(response=COBRO)
        monkeypatch.setattr("canales.movil.api.polizas", polizas)
        monkeypatch.setattr("canales.movil.api.pagos", cobros)

        response = _pagar(headers=authorization())

        assert response.status_code == status
        assert response.json()["detail"] == detalle
        assert cobros.calls == []
        assert _mutaciones(polizas) == []


def test_cobra_exactamente_la_prima_propuesta_del_backend(monkeypatch):
    polizas = _Servicio(response=OFERTA)
    cobros = _Servicio(response=COBRO)
    monkeypatch.setattr("canales.movil.api.polizas", polizas)
    monkeypatch.setattr("canales.movil.api.pagos", cobros)

    response = _pagar({"monto": "1.00", "cliente_id": "intruso", "prima": "9"}, authorization())

    assert response.status_code == 200
    assert response.json() == {
        "id": "cobro-renovacion",
        "poliza_id": "poliza-1",
        "estado": "aprobado",
        "monto": "123456.78",
        "moneda": "COP",
    }
    assert polizas.calls[0][0] == "GET"
    assert polizas.calls[0][1] == "/polizas/poliza-1/renovacion/oferta"
    assert polizas.calls[0][2]["headers"] == {"X-Cliente-Id": "cliente-demo"}
    enviado = cobros.calls[0][2]["json"]
    assert enviado["monto"] == "123456.78"
    assert enviado["tipo_referencia"] == "renovacion"
    assert enviado["referencia_id"] == CICLO
    assert enviado["cliente_id"] == "cliente-demo"
    assert enviado["idempotency_key"] == f"movil:renovacion:{CICLO}:intento-1"
    assert enviado["medio_token"] == "demo-4242"
    assert "cotizacion_id" not in enviado
    assert "1.00" not in enviado.values()
    assert "intruso" not in enviado.values()


def test_un_rechazo_no_muta_la_poliza(monkeypatch):
    polizas = _Servicio(response=OFERTA)
    cobros = _Servicio(response={**COBRO, "estado": "rechazado"})
    monkeypatch.setattr("canales.movil.api.polizas", polizas)
    monkeypatch.setattr("canales.movil.api.pagos", cobros)

    response = _pagar({"simulacion": "rechazado"}, authorization())

    assert response.status_code == 200
    assert response.json()["estado"] == "rechazado"
    assert [llamada[0] for llamada in polizas.calls] == ["GET"]
    assert _mutaciones(polizas) == []
    assert cobros.calls[0][2]["json"]["medio_token"] == "demo-rechazo"


def test_un_error_de_pasarela_no_muta_la_poliza(monkeypatch):
    detalle = {"codigo": "pasarela_no_disponible", "mensaje": "Pasarela de pagos no disponible"}
    polizas = _Servicio(response=OFERTA)
    monkeypatch.setattr("canales.movil.api.polizas", polizas)
    monkeypatch.setattr("canales.movil.api.pagos", _Servicio(error=_error(503, detalle)))

    response = _pagar(headers=authorization())

    assert response.status_code == 503
    assert response.json()["detail"] == detalle
    assert [llamada[0] for llamada in polizas.calls] == ["GET"]
    assert _mutaciones(polizas) == []


def test_un_pago_aprobado_no_aplica_la_renovacion(monkeypatch):
    polizas = _Servicio(response=OFERTA)
    cobros = _Servicio(response=COBRO)
    monkeypatch.setattr("canales.movil.api.polizas", polizas)
    monkeypatch.setattr("canales.movil.api.pagos", cobros)

    response = _pagar(headers=authorization())

    assert response.status_code == 200
    assert response.json()["estado"] == "aprobado"
    assert [llamada[0] for llamada in polizas.calls] == ["GET"]
    assert _mutaciones(polizas) == []
    assert cobros.calls[0][1] == "/pagos/cobros"
    assert all("renovacion" not in llamada[1] or llamada[1].endswith("/oferta") for llamada in polizas.calls)
