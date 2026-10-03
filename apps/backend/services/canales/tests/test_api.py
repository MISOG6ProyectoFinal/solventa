from canales.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "canales"


def test_modulos_montados():
    assert client.get("/web/").status_code == 200
    assert client.get("/movil/").status_code == 200
    assert client.get("/socios/").status_code == 200


def test_socios_exige_api_key():
    assert client.post("/socios/v1/cotizaciones", json={}).status_code == 422


def test_servicio_interno_caido_responde_503():
    assert client.post("/web/cotizaciones", json={"producto_id": "hogar"}).status_code == 503
