from fastapi.testclient import TestClient
from polizas.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "polizas"


def test_info():
    assert client.get("/polizas/").status_code == 200
