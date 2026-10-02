from fastapi.testclient import TestClient
from notificaciones.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "notificaciones"


def test_info():
    assert client.get("/notificaciones/").status_code == 200
