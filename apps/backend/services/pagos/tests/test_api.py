from fastapi.testclient import TestClient
from pagos.main import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "pagos"


def test_modulos_montados():
    assert client.get("/pagos/").status_code == 200
