from cotizacion.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "cotizacion"


def test_modulos_montados():
    assert client.get("/cotizaciones/").status_code == 200
    assert client.get("/consenso/").status_code == 200
    assert client.get("/catalogo/").status_code == 200
    assert client.get("/gobierno-socios/").status_code == 200


def test_calcular():
    body = {"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/cotizaciones/calcular", json=body)
    assert response.status_code == 200
    assert response.json()["prima"] == "900.00"
    assert "coberturas" not in response.json()
    assert "vigencia_propuesta" not in response.json()


def test_catalogo_productos_montado():
    assert client.get("/catalogo/productos").status_code == 200
