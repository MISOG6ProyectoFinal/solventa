import pytest
from fastapi.testclient import TestClient
from siniestros.avisos import api
from siniestros.avisos.adapters.memory import InMemoryAvisoRepository, InMemoryObjectStore
from siniestros.avisos.adapters.object_store import S3ObjectStore
from siniestros.avisos.adapters.repository import PostgresAvisoRepository
from siniestros.config import SiniestrosSettings, settings
from siniestros.main import app

client = TestClient(app)

JPEG = b"\xff\xd8\xff" + b"\x00" * 16
GIF = b"GIF89a" + b"\x00" * 16
AVISO = {
    "poliza_id": "POL-1",
    "tipo": "choque",
    "ocurrido_en": "2026-10-01T00:00:00Z",
    "descripcion": "Golpe en la puerta",
}


@pytest.fixture(autouse=True)
def _avisos_en_memoria():
    api.wire(InMemoryAvisoRepository(), InMemoryObjectStore(), bucket="solventa-evidencias")


def test_persistent_stores_wires_postgres_and_s3(monkeypatch):
    monkeypatch.setattr(settings, "persistent_stores", True)
    monkeypatch.setattr(settings, "database_url", "postgresql+psycopg://solventa:solventa@localhost:5432/siniestros")
    monkeypatch.setattr(PostgresAvisoRepository, "create_schema", lambda self: None)

    api._default_wire()

    assert isinstance(api.object_store, S3ObjectStore)
    assert "amazonaws.com" in api.object_store.client.meta.endpoint_url


def test_persistent_stores_drop_the_localstack_endpoint():
    configured = SiniestrosSettings(persistent_stores=True, aws_endpoint_url="http://localstack:4566")

    assert configured.aws_endpoint_url is None


def test_live():
    assert client.get("/health/live").json()["service"] == "siniestros"


def test_modulos_montados():
    assert client.get("/siniestros/").status_code == 200
    assert client.get("/parametricos/").status_code == 200


def _abrir() -> str:
    response = client.post("/siniestros/avisos", json=AVISO)
    assert response.status_code == 201
    assert response.json()["estado"] == "borrador"
    return response.json()["id"]


def test_abrir_aviso_y_solicitar_carga():
    aviso_id = _abrir()
    response = client.post(
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json={"content_type": "image/jpeg", "bytes": len(JPEG)},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["headers"]["Content-Type"] == "image/jpeg"
    assert body["headers"]["Content-Length"] == str(len(JPEG))
    assert body["upload_url"]


def test_tipo_tamano_limite_y_reporte_desconocido():
    aviso_id = _abrir()
    tipo = client.post(
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json={"content_type": "image/gif", "bytes": 10},
    )
    assert tipo.status_code == 422
    assert tipo.json()["detail"] == "Tipo de archivo no permitido. Use JPEG, PNG o MP4."

    tamano = client.post(
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json={"content_type": "image/png", "bytes": 52_428_801},
    )
    assert tamano.status_code == 422
    assert tamano.json()["detail"] == "El archivo supera 50 MB."

    missing = client.post(
        "/siniestros/avisos/no-existe/evidencias/cargas",
        json={"content_type": "image/jpeg", "bytes": 10},
    )
    assert missing.status_code == 404
    assert missing.json()["detail"] == "No se encontró el reporte."

    for _ in range(10):
        assert (
            client.post(
                f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
                json={"content_type": "video/mp4", "bytes": 10},
            ).status_code
            == 201
        )
    limited = client.post(
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json={"content_type": "video/mp4", "bytes": 10},
    )
    assert limited.status_code == 409
    assert limited.json()["detail"] == "Este reporte ya tiene 10 evidencias."


def test_confirmar_disponible_y_rechazada_fuera_del_listado():
    aviso_id = _abrir()
    ready = client.post(
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json={"content_type": "image/jpeg", "bytes": len(JPEG)},
    ).json()
    api.object_store.guardar(f"avisos/{aviso_id}/evidencias/{ready['evidencia_id']}", "image/jpeg", JPEG)
    confirmed = client.post(f"/siniestros/avisos/{aviso_id}/evidencias/{ready['evidencia_id']}/confirmar")
    assert confirmed.status_code == 200
    assert confirmed.json()["estado"] == "disponible"
    assert confirmed.json()["url"].startswith("s3://solventa-evidencias/avisos/")

    rejected = client.post(
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json={"content_type": "image/jpeg", "bytes": len(GIF)},
    ).json()
    api.object_store.guardar(f"avisos/{aviso_id}/evidencias/{rejected['evidencia_id']}", "image/jpeg", GIF)
    failed = client.post(f"/siniestros/avisos/{aviso_id}/evidencias/{rejected['evidencia_id']}/confirmar")
    assert failed.status_code == 422
    assert failed.json()["detail"] == "El archivo no pasó la validación."

    listed = client.get(f"/siniestros/avisos/{aviso_id}/evidencias")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [ready["evidencia_id"]]
    assert listed.json()[0]["download_url"]


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
