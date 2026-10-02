from fastapi.testclient import TestClient
from reaseguro.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "reaseguro"


def test_info():
    assert client.get("/reaseguro/").status_code == 200
