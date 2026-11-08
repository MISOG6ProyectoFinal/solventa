"""HU037: el BFF autentica y delega la aplicación de la renovación en Pólizas."""

import httpx
from canales.main import app
from fastapi.testclient import TestClient

from tests.movil_auth import authorization
from tests.servicio import Servicio as _Servicio

client = TestClient(app)

CONFIRMADA = {
    "poliza_id": "poliza-1",
    "numero_poliza": "POL-1",
    "producto_id": "viaje-internacional",
    "estado": "aplicada",
    "cobro_id": "cobro-1",
    "vigencia_anterior": {"desde": "2026-01-01", "hasta": "2026-12-31"},
    "vigencia_nueva": {"desde": "2027-01-01", "hasta": "2027-12-31"},
    "coberturas": [{"id": "medicos", "nombre": "Gastos médicos"}],
}


def _error(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://polizas/polizas/poliza-1/renovaciones")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


def _aplicar(body: dict | None = None, headers: dict | None = None):
    payload = {"cobro_id": "cobro-1"}
    if body:
        payload.update(body)
    return client.post("/movil/polizas/poliza-1/renovaciones", json=payload, headers=headers)


def test_aplicar_renovacion_exige_sesion():
    response = _aplicar()

    assert response.status_code == 401
    assert response.json()["detail"] == "La sesión no es válida"


def test_delega_en_polizas_con_el_cliente_de_la_sesion(monkeypatch):
    polizas = _Servicio(response=CONFIRMADA)
    pagos = _Servicio(error=AssertionError("pagos no participa"))
    monkeypatch.setattr("canales.movil.api.polizas", polizas)
    monkeypatch.setattr("canales.movil.api.pagos", pagos)

    response = _aplicar(
        {
            "cliente_id": "intruso",
            "estado": "aprobado",
            "monto": "1.00",
            "moneda": "USD",
            "vigencia_nueva": {"desde": "1999-01-01", "hasta": "1999-12-31"},
        },
        authorization(),
    )

    assert response.status_code == 200
    assert response.json() == CONFIRMADA
    assert polizas.calls == [
        (
            "POST",
            "/polizas/poliza-1/renovaciones",
            {"json": {"cobro_id": "cobro-1"}, "headers": {"X-Cliente-Id": "cliente-demo"}},
        )
    ]


def test_un_pago_no_aprobado_se_propaga(monkeypatch):
    detalle = {"codigo": "pago_no_aprobado", "mensaje": "El pago no está aprobado. La renovación no se aplicó."}
    monkeypatch.setattr("canales.movil.api.polizas", _Servicio(error=_error(409, detalle)))

    response = _aplicar(headers=authorization())

    assert response.status_code == 409
    assert response.json()["detail"] == detalle


def test_polizas_no_disponible_se_propaga(monkeypatch):
    detalle = {"codigo": "servicio_no_disponible", "mensaje": "Pólizas no disponible"}
    monkeypatch.setattr("canales.movil.api.polizas", _Servicio(error=_error(503, detalle)))

    response = _aplicar(headers=authorization())

    assert response.status_code == 503
    assert response.json()["detail"] == detalle
