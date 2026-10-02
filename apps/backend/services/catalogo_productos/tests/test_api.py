from catalogo_productos.entrypoints.api import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "catalogo-productos"


def test_info():
    assert client.get("/catalogo/").status_code == 200
