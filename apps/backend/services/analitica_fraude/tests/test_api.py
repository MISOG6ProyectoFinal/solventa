from analitica_fraude.entrypoints.api import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "analitica-fraude"


def test_info():
    assert client.get("/analitica/").status_code == 200
