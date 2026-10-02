from fastapi.testclient import TestClient
from identidad_kyc.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "identidad-kyc"


def test_info():
    assert client.get("/identidad/").status_code == 200
