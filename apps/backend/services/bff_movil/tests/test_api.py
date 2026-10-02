from bff_movil.entrypoints.api import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "bff-movil"


def test_info():
    assert client.get("/movil/").status_code == 200
