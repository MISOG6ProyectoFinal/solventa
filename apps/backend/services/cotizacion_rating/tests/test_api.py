from cotizacion_rating.entrypoints.api import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "cotizacion-rating"


def test_info():
    assert client.get("/cotizaciones/").status_code == 200


def test_calcular():
    body = {"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/cotizaciones/calcular", json=body)
    assert response.status_code == 200
    assert response.json()["prima"] == "900.00"
