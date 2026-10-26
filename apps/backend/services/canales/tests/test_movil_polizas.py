"""Emisión móvil: el BFF identifica la sesión y Pólizas valida cotización y cobro."""

import httpx
from canales.main import app
from fastapi.testclient import TestClient

from tests.movil_auth import authorization

client = TestClient(app)

POLIZA = {
    "id": "poliza-1",
    "numero": "POL-75885ABCDE",
    "estado": "activa",
    "cotizacion_id": "oferta-1",
    "cobro_id": "cobro-1",
    "producto_id": "viaje-internacional",
    "prima": "149940.00",
    "vigencia": {"desde": "2026-10-10", "hasta": "2026-10-24"},
    "cliente_id": "cliente-demo",
}


class _Servicio:
    def __init__(self, respuesta=None, error: Exception | None = None) -> None:
        self.respuesta = respuesta
        self.error = error
        self.calls: list[tuple[str, dict]] = []

    def get(self, path: str, **kwargs):
        self.calls.append((path, kwargs))
        if self.error:
            raise self.error
        return self.respuesta

    def post(self, path: str, **kwargs):
        self.calls.append((path, kwargs))
        if self.error:
            raise self.error
        return self.respuesta


def _error(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://interno/recurso")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


def _emitir(body: dict | None = None, headers: dict | None = None, cotizacion_id: str = "oferta-1"):
    payload = {"cobro_id": "cobro-1"}
    if body:
        payload.update(body)
    return client.post(f"/movil/cotizaciones/{cotizacion_id}/polizas", json=payload, headers=headers)


def test_emitir_exige_sesion():
    response = _emitir()
    assert response.status_code == 401
    assert response.json()["detail"] == "La sesión no es válida"


def test_emite_con_la_sesion_y_no_reenvia_datos_del_telefono(monkeypatch):
    pagos = _Servicio()
    cotizaciones = _Servicio()
    emisiones = _Servicio(respuesta=POLIZA)
    monkeypatch.setattr("canales.movil.api.pagos", pagos)
    monkeypatch.setattr("canales.movil.api.cotizacion", cotizaciones)
    monkeypatch.setattr("canales.movil.api.polizas", emisiones)

    response = _emitir(
        {
            "prima": "1.00",
            "producto_id": "falso",
            "producto_nombre": "Inventado en el teléfono",
            "vigencia_desde": "1999-01-01",
            "vigencia_hasta": "1999-01-02",
            "coberturas": [{"id": "x", "nombre": "Cobertura inventada"}],
            "estado": "activa",
            "pago_aprobado": True,
            "degradada": False,
            "cliente_id": "intruso",
            "canal": "socios",
            "idempotency_key": "clave-del-telefono",
            "simulacion": "fallida",
        },
        authorization(),
    )

    assert response.status_code == 200
    assert response.json()["numero"] == "POL-75885ABCDE"
    assert pagos.calls == []
    assert cotizaciones.calls == []
    assert emisiones.calls[0][0] == "/polizas/emisiones"
    assert emisiones.calls[0][1]["json"] == {
        "cotizacion_id": "oferta-1",
        "cobro_id": "cobro-1",
        "idempotency_key": "mobile:cliente-demo:oferta-1:cobro-1",
        "canal": "mobile",
        "cliente_id": "cliente-demo",
    }


def test_el_reintento_reutiliza_la_misma_clave(monkeypatch):
    emisiones = _Servicio(respuesta=POLIZA)
    monkeypatch.setattr("canales.movil.api.polizas", emisiones)

    _emitir(headers=authorization())
    _emitir(headers=authorization())

    claves = [llamada[1]["json"]["idempotency_key"] for llamada in emisiones.calls]
    assert claves == ["mobile:cliente-demo:oferta-1:cobro-1", "mobile:cliente-demo:oferta-1:cobro-1"]


def test_listar_polizas_exige_sesion_y_usa_el_cliente_de_la_sesion(monkeypatch):
    assert client.get("/movil/polizas").status_code == 401
    emisiones = _Servicio(respuesta=[{"id": "poliza-1", "estado": "activa"}])
    monkeypatch.setattr("canales.movil.api.polizas", emisiones)

    response = client.get("/movil/polizas", params={"cliente_id": "intruso"}, headers=authorization())

    assert response.status_code == 200
    assert response.json()[0]["id"] == "poliza-1"
    assert emisiones.calls[0][0] == "/polizas/clientes/cliente-demo"
    assert "intruso" not in str(emisiones.calls)


def test_conserva_el_error_estructurado_de_polizas(monkeypatch):
    detalle = {
        "codigo": "pago_no_aprobado",
        "mensaje": "El pago no está aprobado para esta cotización. No se emitió la póliza.",
    }
    monkeypatch.setattr("canales.movil.api.polizas", _Servicio(error=_error(409, detalle)))

    response = _emitir(headers=authorization())

    assert response.status_code == 409
    assert response.json()["detail"] == detalle
