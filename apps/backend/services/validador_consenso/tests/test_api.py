from fastapi.testclient import TestClient
from validador_consenso.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "validador-consenso"


def test_info():
    assert client.get("/consenso/").status_code == 200
