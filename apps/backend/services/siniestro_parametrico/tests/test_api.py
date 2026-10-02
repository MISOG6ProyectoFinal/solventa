from fastapi.testclient import TestClient
from siniestro_parametrico.entrypoints.api import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "siniestro-parametrico"


def test_info():
    assert client.get("/parametricos/").status_code == 200


def test_registrar_evento_responde_202():
    body = {
        "fuente": "ideam",
        "clave_evento": "e-1",
        "poliza_id": "POL-1",
        "tipo": "precipitacion_mm",
        "valor_observado": "120",
        "umbral": "100",
        "monto_asegurado": "1000",
        "observado_en": "2026-10-01T00:00:00Z",
    }
    response = client.post("/parametricos/eventos", json=body)
    assert response.status_code == 202
    assert response.json()["idempotency_key"] == "ideam:e-1:POL-1"
