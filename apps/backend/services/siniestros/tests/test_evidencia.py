from datetime import UTC, datetime, timedelta

import pytest
from siniestros.avisos.adapters.memory import InMemoryAvisoRepository, InMemoryObjectStore
from siniestros.avisos.domain.errors import ReglaEvidencia
from siniestros.avisos.domain.use_cases import (
    ConfirmarCargaUseCase,
    CrearAvisoUseCase,
    ListarEvidenciasUseCase,
    RadicarAvisoUseCase,
    SolicitarCargaUseCase,
)

BUCKET = "solventa-evidencias"
JPEG = b"\xff\xd8\xff" + b"\x00" * 16
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
MP4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 8
GIF = b"GIF89a" + b"\x00" * 16

TIPO = "Tipo de archivo no permitido. Use JPEG, PNG o MP4."
TAMANO = "El archivo supera 50 MB."
LIMITE = "Este reporte ya tiene 10 evidencias."


def build():
    repo = InMemoryAvisoRepository()
    store = InMemoryObjectStore()
    return (
        repo,
        store,
        CrearAvisoUseCase(repo),
        SolicitarCargaUseCase(repo, store, BUCKET),
        ConfirmarCargaUseCase(repo, store),
        ListarEvidenciasUseCase(repo, store),
    )


def aviso(crear: CrearAvisoUseCase):
    return crear.execute(
        poliza_id="POL-1",
        tipo="choque",
        ocurrido_en=datetime(2026, 10, 1, tzinfo=UTC),
        descripcion="Golpe en la puerta",
        ubicacion="Bogotá",
        cliente_id="cliente-1",
    )


def test_crear_aviso_queda_en_borrador():
    _, _, crear, _, _, _ = build()
    created = aviso(crear)
    assert created.id
    assert created.estado == "borrador"


def test_radicar_sin_evidencia_disponible_sigue_en_borrador():
    repo, _, crear, _, _, _ = build()
    created = aviso(crear)

    with pytest.raises(ReglaEvidencia) as error:
        RadicarAvisoUseCase(repo).execute(created.id, cliente_id="cliente-1")

    assert error.value.status == 422
    assert error.value.message == "Agrega al menos una evidencia"
    assert repo.get_aviso(created.id).estado == "borrador"


def test_radicar_deja_el_aviso_radicado_cuando_hay_evidencia():
    repo, store, crear, solicitar, confirmar, _ = build()
    created = aviso(crear)
    carga = solicitar.execute(created.id, "image/jpeg", len(JPEG), cliente_id="cliente-1")
    store.guardar(repo.get_evidencia(created.id, carga.evidencia_id).object_key, "image/jpeg", JPEG)
    confirmar.execute(created.id, carga.evidencia_id, cliente_id="cliente-1")

    filed = RadicarAvisoUseCase(repo).execute(created.id, cliente_id="cliente-1")
    again = RadicarAvisoUseCase(repo).execute(created.id, cliente_id="cliente-1")

    assert filed.estado == "radicado"
    assert again.estado == "radicado"
    assert repo.get_aviso(created.id).estado == "radicado"


def test_crear_aviso_queda_asociado_al_cliente():
    repo, _, crear, _, _, _ = build()
    created = crear.execute(
        poliza_id="POL-1",
        tipo="choque",
        ocurrido_en=datetime(2026, 10, 1, tzinfo=UTC),
        descripcion="Golpe en la puerta",
        cliente_id="cliente-demo",
    )
    loaded = repo.get_aviso(created.id)
    assert loaded is not None
    assert loaded.cliente_id == "cliente-demo"
    assert created.cliente_id == "cliente-demo"


def test_solicitar_carga_jpeg_queda_pendiente():
    repo, _, crear, solicitar, _, _ = build()
    created = aviso(crear)
    carga = solicitar.execute(created.id, "image/jpeg", 1200, cliente_id="cliente-1")
    assert carga.upload_url
    assert carga.headers["Content-Type"] == "image/jpeg"
    assert carga.headers["Content-Length"] == "1200"
    assert carga.expires_at - datetime.now(UTC) > timedelta(minutes=14)
    evidencia = repo.get_evidencia(created.id, carga.evidencia_id)
    assert evidencia is not None
    assert evidencia.estado == "pendiente_carga"


@pytest.mark.parametrize("content_type", ["image/png", "video/mp4"])
def test_png_y_mp4_se_aceptan(content_type):
    _, _, crear, solicitar, _, _ = build()
    created = aviso(crear)
    carga = solicitar.execute(created.id, content_type, 10, cliente_id="cliente-1")
    assert carga.evidencia_id


@pytest.mark.parametrize("content_type", ["image/gif", "application/pdf"])
def test_tipo_no_permitido(content_type):
    _, _, crear, solicitar, _, _ = build()
    created = aviso(crear)
    with pytest.raises(ReglaEvidencia) as error:
        solicitar.execute(created.id, content_type, 10, cliente_id="cliente-1")
    assert error.value.message == TIPO


@pytest.mark.parametrize("size", [0, 52_428_801])
def test_tamano_fuera_de_rango(size):
    _, _, crear, solicitar, _, _ = build()
    created = aviso(crear)
    with pytest.raises(ReglaEvidencia) as error:
        solicitar.execute(created.id, "image/jpeg", size, cliente_id="cliente-1")
    assert error.value.message == TAMANO


def test_la_evidencia_11_se_rechaza_y_una_rechazada_no_cuenta():
    repo, _, crear, solicitar, confirmar, _ = build()
    created = aviso(crear)
    rejected = solicitar.execute(created.id, "image/jpeg", len(JPEG), cliente_id="cliente-1")
    with pytest.raises(ReglaEvidencia):
        confirmar.execute(created.id, rejected.evidencia_id, cliente_id="cliente-1")
    assert repo.get_evidencia(created.id, rejected.evidencia_id).estado == "rechazada"

    for _ in range(10):
        solicitar.execute(created.id, "image/jpeg", len(JPEG), cliente_id="cliente-1")

    with pytest.raises(ReglaEvidencia) as error:
        solicitar.execute(created.id, "image/jpeg", len(JPEG), cliente_id="cliente-1")
    assert error.value.message == LIMITE


@pytest.mark.parametrize(
    ("content_type", "body"),
    [("image/jpeg", JPEG), ("image/png", PNG), ("video/mp4", MP4)],
)
def test_confirmar_con_cabecera_valida_la_deja_disponible(content_type, body):
    repo, store, crear, solicitar, confirmar, _ = build()
    created = aviso(crear)
    carga = solicitar.execute(created.id, content_type, len(body), cliente_id="cliente-1")
    evidencia = repo.get_evidencia(created.id, carga.evidencia_id)
    store.guardar(evidencia.object_key, content_type, body)

    result = confirmar.execute(created.id, carga.evidencia_id, cliente_id="cliente-1")

    assert result.estado == "disponible"
    assert result.url == f"s3://{BUCKET}/{evidencia.object_key}"


@pytest.mark.parametrize(
    ("content_type", "body", "declared"),
    [
        ("image/jpeg", None, None),
        ("image/jpeg", JPEG + b"\x00", len(JPEG)),
        ("image/jpeg", GIF, len(GIF)),
    ],
)
def test_confirmar_invalido_rechaza(content_type, body, declared):
    repo, store, crear, solicitar, confirmar, _ = build()
    created = aviso(crear)
    size = declared if declared is not None else len(JPEG)
    carga = solicitar.execute(created.id, content_type, size, cliente_id="cliente-1")
    evidencia = repo.get_evidencia(created.id, carga.evidencia_id)
    if body is not None:
        store.guardar(evidencia.object_key, content_type, body)

    with pytest.raises(ReglaEvidencia) as error:
        confirmar.execute(created.id, carga.evidencia_id, cliente_id="cliente-1")

    assert error.value.message == "El archivo no pasó la validación."
    assert repo.get_evidencia(created.id, carga.evidencia_id).estado == "rechazada"


def test_otro_cliente_no_opera_el_reporte():
    _, _, crear, solicitar, confirmar, listar = build()
    created = aviso(crear)

    for action in (
        lambda: solicitar.execute(created.id, "image/jpeg", 10, cliente_id="otro"),
        lambda: confirmar.execute(created.id, "ev-1", cliente_id="otro"),
        lambda: listar.execute(created.id, cliente_id="otro"),
    ):
        with pytest.raises(ReglaEvidencia) as error:
            action()
        assert error.value.status == 404
        assert error.value.message == "No se encontró el reporte."


def test_reporte_desconocido():
    _, _, _, solicitar, _, _ = build()
    with pytest.raises(ReglaEvidencia) as error:
        solicitar.execute("no-existe", "image/jpeg", 10, cliente_id="cliente-1")
    assert error.value.message == "No se encontró el reporte."
    assert error.value.status == 404


def test_confirmar_con_content_type_distinto_rechaza():
    repo, store, crear, solicitar, confirmar, _ = build()
    created = aviso(crear)
    carga = solicitar.execute(created.id, "image/jpeg", len(JPEG), cliente_id="cliente-1")
    evidencia = repo.get_evidencia(created.id, carga.evidencia_id)
    store.guardar(evidencia.object_key, "text/plain", JPEG)

    with pytest.raises(ReglaEvidencia) as error:
        confirmar.execute(created.id, carga.evidencia_id, cliente_id="cliente-1")

    assert error.value.message == "El archivo no pasó la validación."
    assert repo.get_evidencia(created.id, carga.evidencia_id).estado == "rechazada"


def test_el_listado_solo_incluye_disponibles_con_url_de_descarga():
    repo, store, crear, solicitar, confirmar, listar = build()
    created = aviso(crear)
    pending = solicitar.execute(created.id, "video/mp4", len(MP4), cliente_id="cliente-1")
    ready = solicitar.execute(created.id, "image/png", len(PNG), cliente_id="cliente-1")
    ready_row = repo.get_evidencia(created.id, ready.evidencia_id)
    store.guardar(ready_row.object_key, "image/png", PNG)
    confirmar.execute(created.id, ready.evidencia_id, cliente_id="cliente-1")

    listed = listar.execute(created.id, cliente_id="cliente-1")

    assert [item.id for item in listed] == [ready.evidencia_id]
    assert pending.evidencia_id not in [item.id for item in listed]
    assert listed[0].download_url
    assert listed[0].estado == "disponible"
