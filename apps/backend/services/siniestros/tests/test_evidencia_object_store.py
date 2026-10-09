import io
from datetime import UTC, datetime

import pytest
from botocore.exceptions import ClientError
from botocore.response import StreamingBody
from siniestros.avisos.adapters.memory import InMemoryAvisoRepository
from siniestros.avisos.adapters.object_store import S3ObjectStore
from siniestros.avisos.domain.use_cases import ConfirmarCargaUseCase, CrearAvisoUseCase, SolicitarCargaUseCase

BUCKET = "solventa-evidencias"
JPEG = b"\xff\xd8\xff" + b"\x00" * 16


@pytest.fixture
def store(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")
    return S3ObjectStore(BUCKET, "us-east-1")


def test_presign_ignora_el_endpoint_del_entorno(monkeypatch):
    monkeypatch.setenv("AWS_ENDPOINT_URL", "http://192.168.1.52:4566")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")
    store = S3ObjectStore(BUCKET, "us-east-1")

    url, _, _ = store.presign_put("avisos/a/evidencias/e", "image/jpeg", len(JPEG))

    assert "192.168.1.52" not in url
    assert "amazonaws.com" in url


def test_presign_put_firma_tipo_y_tamano(store):
    url, headers, expires_at = store.presign_put("avisos/a/evidencias/e", "image/jpeg", len(JPEG))
    signed = url.lower()
    assert "content-type" in signed
    assert "content-length" in signed
    assert headers == {"Content-Type": "image/jpeg", "Content-Length": str(len(JPEG))}
    assert expires_at > datetime.now(UTC)


def test_head_de_una_clave_ausente_no_falla(store):
    stubber = _stubber(store)
    stubber.add_client_error(
        "head_object",
        service_error_code="404",
        service_message="Not Found",
        http_status_code=404,
        expected_params={"Bucket": BUCKET, "Key": "missing"},
    )
    stubber.activate()
    assert store.head("missing") is None


def test_head_y_cabecera_de_un_jpeg(store):
    key = "avisos/a/evidencias/e"
    stubber = _stubber(store)
    stubber.add_response(
        "head_object",
        {"ContentLength": len(JPEG), "ContentType": "image/jpeg"},
        {"Bucket": BUCKET, "Key": key},
    )
    stubber.add_response(
        "get_object",
        {"Body": StreamingBody(io.BytesIO(JPEG), len(JPEG)), "ContentLength": len(JPEG)},
        {"Bucket": BUCKET, "Key": key, "Range": "bytes=0-31"},
    )
    stubber.activate()

    stored = store.head(key)
    assert stored is not None
    assert stored.size == len(JPEG)
    assert stored.content_type == "image/jpeg"
    assert store.read_header(key).startswith(b"\xff\xd8\xff")


def test_presign_get_apunta_al_objeto(store):
    key = "avisos/a/evidencias/e"
    url = store.presign_get(key)
    assert key in url
    assert "X-Amz-Signature" in url


def test_confirmar_usa_el_adapter_de_s3(store):
    repo = InMemoryAvisoRepository()
    crear = CrearAvisoUseCase(repo)
    solicitar = SolicitarCargaUseCase(repo, store, BUCKET)
    confirmar = ConfirmarCargaUseCase(repo, store)
    created = crear.execute("POL-1", "choque", datetime(2026, 10, 1, tzinfo=UTC), "Golpe")
    carga = solicitar.execute(created.id, "image/jpeg", len(JPEG))
    evidencia = repo.get_evidencia(created.id, carga.evidencia_id)
    assert evidencia is not None

    stubber = _stubber(store)
    stubber.add_response(
        "head_object",
        {"ContentLength": len(JPEG), "ContentType": "image/jpeg"},
        {"Bucket": BUCKET, "Key": evidencia.object_key},
    )
    stubber.add_response(
        "get_object",
        {"Body": StreamingBody(io.BytesIO(JPEG), len(JPEG)), "ContentLength": len(JPEG)},
        {"Bucket": BUCKET, "Key": evidencia.object_key, "Range": "bytes=0-31"},
    )
    stubber.activate()

    result = confirmar.execute(created.id, carga.evidencia_id)
    assert result.estado == "disponible"
    assert result.url == f"s3://{BUCKET}/{evidencia.object_key}"


def test_head_de_un_bucket_ausente_se_propaga(store, caplog):
    stubber = _stubber(store)
    stubber.add_client_error(
        "head_object",
        service_error_code="NoSuchBucket",
        service_message="The specified bucket does not exist",
        http_status_code=404,
        expected_params={"Bucket": BUCKET, "Key": "missing"},
    )
    stubber.activate()
    with caplog.at_level("ERROR"), pytest.raises(ClientError):
        store.head("missing")
    assert "NoSuchBucket" in caplog.text
    assert BUCKET in caplog.text


def test_un_error_distinto_de_404_se_propaga(store):
    stubber = _stubber(store)
    stubber.add_client_error(
        "head_object",
        service_error_code="403",
        service_message="Forbidden",
        http_status_code=403,
        expected_params={"Bucket": BUCKET, "Key": "denied"},
    )
    stubber.activate()
    with pytest.raises(ClientError):
        store.head("denied")


def _stubber(store: S3ObjectStore):
    from botocore.stub import Stubber

    return Stubber(store.client)
