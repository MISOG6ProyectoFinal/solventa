from fastapi.testclient import TestClient
from perfilamiento.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "perfilamiento"


def test_info():
    assert client.get("/perfiles/").status_code == 200
