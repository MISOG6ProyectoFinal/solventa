import os

import httpx
import pytest
from fastapi.testclient import TestClient
from siniestros.avisos import api
from siniestros.avisos.adapters.object_store import S3ObjectStore
from siniestros.avisos.adapters.repository import PostgresAvisoRepository
from siniestros.config import settings
from siniestros.main import app
from solventa_common.db import build_engine

pytestmark = pytest.mark.skipif(
    not os.getenv("DB_HOST") or not os.getenv("AWS_ENDPOINT_URL"),
    reason="Requiere Postgres y LocalStack",
)

JPEG = b"\xff\xd8\xff" + b"\x00" * 16
GIF = b"GIF89a" + b"\x00" * 16
BUCKET = "solventa-evidencias"


def _client() -> TestClient:
    engine = build_engine(settings.database_url)
    repository = PostgresAvisoRepository(engine)
    store = S3ObjectStore(BUCKET, settings.aws_region, settings.aws_endpoint_url)
    try:
        store.client.head_bucket(Bucket=BUCKET)
    except Exception:
        store.client.create_bucket(Bucket=BUCKET)
    api.wire(repository, store, bucket=BUCKET)
    return TestClient(app)


def _aviso(client: TestClient) -> str:
    response = client.post(
        "/siniestros/avisos",
        json={
            "poliza_id": "POL-1",
            "tipo": "choque",
            "ocurrido_en": "2026-10-01T00:00:00Z",
            "descripcion": "Golpe en la puerta",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_la_carga_queda_disponible_y_un_gif_se_rechaza():
    client = _client()
    aviso_id = _aviso(client)
    carga = client.post(
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json={"content_type": "image/jpeg", "bytes": len(JPEG)},
    )
    assert carga.status_code == 201
    body = carga.json()
    put = httpx.put(body["upload_url"], content=JPEG, headers=body["headers"])
    assert put.status_code in {200, 204}

    confirmed = client.post(f"/siniestros/avisos/{aviso_id}/evidencias/{body['evidencia_id']}/confirmar")
    assert confirmed.status_code == 200
    assert confirmed.json()["url"].startswith(f"s3://{BUCKET}/avisos/")

    listed = client.get(f"/siniestros/avisos/{aviso_id}/evidencias")
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    downloaded = httpx.get(items[0]["download_url"])
    assert downloaded.status_code == 200
    assert downloaded.content == JPEG

    otro_id = _aviso(client)
    falsa = client.post(
        f"/siniestros/avisos/{otro_id}/evidencias/cargas",
        json={"content_type": "image/jpeg", "bytes": len(GIF)},
    )
    assert falsa.status_code == 201
    falsa_body = falsa.json()
    httpx.put(falsa_body["upload_url"], content=GIF, headers=falsa_body["headers"])
    rejected = client.post(f"/siniestros/avisos/{otro_id}/evidencias/{falsa_body['evidencia_id']}/confirmar")
    assert rejected.status_code == 422
    assert rejected.json()["detail"] == "El archivo no pasó la validación."
    assert client.get(f"/siniestros/avisos/{otro_id}/evidencias").json() == []
