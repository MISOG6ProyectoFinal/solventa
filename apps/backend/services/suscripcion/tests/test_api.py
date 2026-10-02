from fastapi.testclient import TestClient
from suscripcion.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "suscripcion"


def test_info():
    assert client.get("/suscripciones/").status_code == 200
