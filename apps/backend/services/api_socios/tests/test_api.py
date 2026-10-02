from api_socios.entrypoints.api import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "api-socios"


def test_info():
    assert client.get("/socios/").status_code == 200


def test_cotizar_exige_api_key():
    assert client.post("/socios/v1/cotizaciones", json={}).status_code == 422
