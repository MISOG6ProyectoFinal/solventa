from fastapi.testclient import TestClient
from solventa_common.app import create_app
from solventa_common.settings import ServiceSettings


def test_ready_reports_degraded_dependency():
    app = create_app(ServiceSettings(service_name="t"), readiness_checks={"db": lambda: False, "cache": lambda: True})
    client = TestClient(app)
    assert client.get("/health/live").status_code == 200
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["checks"] == {"db": False, "cache": True}
