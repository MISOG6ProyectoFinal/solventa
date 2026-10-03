from fastapi.testclient import TestClient
from polizas.main import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "polizas"


def test_modulos_montados():
    assert client.get("/suscripciones/").status_code == 200
    assert client.get("/polizas/").status_code == 200
    assert client.get("/reaseguro/").status_code == 200
