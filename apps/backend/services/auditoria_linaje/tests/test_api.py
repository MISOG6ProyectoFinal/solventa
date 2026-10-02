from auditoria_linaje.entrypoints.api import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "auditoria-linaje"


def test_info():
    assert client.get("/auditoria/").status_code == 200
