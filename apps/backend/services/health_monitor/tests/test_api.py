from fastapi.testclient import TestClient
from health_monitor.main import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "health-monitor"


def test_info():
    assert client.get("/monitor/").status_code == 200
