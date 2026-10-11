from fastapi.testclient import TestClient
from solventa_common.app import create_app
from solventa_common.settings import ServiceSettings

ORIGEN = "http://localhost:4200"


def _preflight(app, origen: str):
    headers = {"Origin": origen, "Access-Control-Request-Method": "POST"}
    return TestClient(app).options("/health/live", headers=headers)


def test_cors_autoriza_solo_los_origenes_configurados():
    app = create_app(ServiceSettings(cors_origins=f"{ORIGEN}, https://portal.solventa.co"))

    assert _preflight(app, ORIGEN).headers["access-control-allow-origin"] == ORIGEN
    assert "access-control-allow-origin" not in _preflight(app, "https://otro.sitio").headers


def test_sin_origenes_configurados_no_hay_cors():
    app = create_app(ServiceSettings())

    assert "access-control-allow-origin" not in _preflight(app, ORIGEN).headers
