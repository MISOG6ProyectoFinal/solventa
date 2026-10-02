from bff_web.entrypoints.api import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "bff-web"


def test_info():
    assert client.get("/web/").status_code == 200


def test_upstream_caido_responde_503():
    response = client.post("/web/cotizaciones", json={"producto_id": "hogar"})
    assert response.status_code == 503
