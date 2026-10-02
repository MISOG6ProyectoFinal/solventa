from fastapi.testclient import TestClient
from siniestros.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "siniestros"


def test_info():
    assert client.get("/siniestros/").status_code == 200
