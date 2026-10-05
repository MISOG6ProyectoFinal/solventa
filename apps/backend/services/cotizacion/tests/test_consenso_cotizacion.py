"""Pruebas de la oferta de cotización vía consenso (persistencia de negocio)."""

from cotizacion.container import container
from cotizacion.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_rechaza_cotizacion_para_producto_inexistente():
    body = {"producto_id": "no-existe", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/consenso/cotizaciones", json=body)
    assert response.status_code == 404


def test_rechaza_cotizacion_para_producto_no_habilitado():
    body = {"producto_id": "vida-temporal", "suma_asegurada": "100000000", "edad": 40}
    response = client.post("/consenso/cotizaciones", json=body)
    assert response.status_code == 422


def test_cotizacion_devuelve_prima_coberturas_y_vigencia():
    body = {"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/consenso/cotizaciones", json=body)
    assert response.status_code == 200
    data = response.json()
    assert data["producto_id"] == "hogar"
    assert data["prima"] == "900.00"
    assert data["version_reglas"] == "2026.10.0"
    assert len(data["coberturas"]) >= 2
    assert "desde" in data["vigencia_propuesta"]
    assert "hasta" in data["vigencia_propuesta"]
    assert data["vigencia_propuesta"]["hasta"] > data["vigencia_propuesta"]["desde"]


def test_consenso_persiste_una_sola_cotizacion():
    antes = container.cotizaciones.count()
    body = {"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/consenso/cotizaciones", json=body)
    assert response.status_code == 200
    assert container.cotizaciones.count() == antes + 1


def test_calculo_de_rating_no_persiste_cotizacion():
    antes = container.cotizaciones.count()
    body = {"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/cotizaciones/calcular", json=body)
    assert response.status_code == 200
    assert "coberturas" not in response.json()
    assert "vigencia_propuesta" not in response.json()
    assert container.cotizaciones.count() == antes
