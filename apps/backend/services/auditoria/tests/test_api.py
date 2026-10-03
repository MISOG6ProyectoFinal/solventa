from auditoria.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "auditoria"


def test_modulos_montados():
    assert client.get("/auditoria/").status_code == 200
    assert client.get("/analitica/").status_code == 200
    assert client.get("/notificaciones/").status_code == 200
