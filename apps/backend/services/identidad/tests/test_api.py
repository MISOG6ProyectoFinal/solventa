from fastapi.testclient import TestClient
from identidad.main import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "identidad"


def test_modulos_montados():
    assert client.get("/identidad/").status_code == 200
    assert client.get("/perfiles/").status_code == 200
