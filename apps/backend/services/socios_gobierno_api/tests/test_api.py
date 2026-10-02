from fastapi.testclient import TestClient
from socios_gobierno_api.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "socios-gobierno-api"


def test_info():
    assert client.get("/gobierno-socios/").status_code == 200
