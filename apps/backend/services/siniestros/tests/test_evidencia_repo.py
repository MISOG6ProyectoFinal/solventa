import os
from datetime import UTC, datetime

import pytest
from siniestros.avisos.adapters.repository import PostgresAvisoRepository
from siniestros.avisos.domain.models import Aviso, Evidencia
from sqlalchemy import create_engine, inspect


def _postgres_url() -> str | None:
    host = os.getenv("DB_HOST")
    if not host:
        return None
    user = os.environ["DB_USER"]
    password = os.environ["DB_PASSWORD"]
    name = os.environ["DB_NAME"]
    port = os.getenv("DB_PORT", "5432")
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}"


def _params():
    params = [pytest.param("sqlite://", id="sqlite")]
    url = _postgres_url()
    if url is None:
        params.append(pytest.param(None, marks=pytest.mark.skip(reason="DB_HOST no está definido"), id="postgres"))
    else:
        params.append(pytest.param(url, id="postgres"))
    return params


@pytest.fixture(params=_params())
def repository(request):
    if request.param is None:
        pytest.skip("DB_HOST no está definido")
    engine = create_engine(request.param)
    repo = PostgresAvisoRepository(engine)
    repo.create_schema()
    return repo


def _aviso(aviso_id: str = "aviso-1") -> Aviso:
    return Aviso(
        id=aviso_id,
        poliza_id="POL-1",
        tipo="choque",
        ocurrido_en=datetime(2026, 10, 1, 12, 0, tzinfo=UTC),
        descripcion="Golpe en la puerta",
        ubicacion=None,
        estado="borrador",
    )


def _evidencia(aviso_id: str, evidencia_id: str, estado: str) -> Evidencia:
    return Evidencia(
        id=evidencia_id,
        aviso_id=aviso_id,
        object_key=f"avisos/{aviso_id}/evidencias/{evidencia_id}",
        url=f"s3://solventa-evidencias/avisos/{aviso_id}/evidencias/{evidencia_id}",
        content_type="image/jpeg",
        tamano=1200,
        estado=estado,
    )


def test_create_schema_crea_las_tablas(repository):
    names = inspect(repository.engine).get_table_names()
    assert "avisos" in names
    assert "evidencias" in names


def test_un_borrador_se_lee_por_id(repository):
    saved = _aviso()
    repository.add_aviso(saved)
    loaded = repository.get_aviso(saved.id)
    assert loaded is not None
    assert loaded.poliza_id == saved.poliza_id
    assert loaded.estado == "borrador"
    assert loaded.descripcion == saved.descripcion
    assert loaded.ubicacion is None
    assert loaded.ocurrido_en.replace(tzinfo=None) == saved.ocurrido_en.replace(tzinfo=None)


def test_la_evidencia_conserva_el_estado(repository):
    repository.add_aviso(_aviso())
    repository.add_evidencia(_evidencia("aviso-1", "ev-1", "pendiente_carga"))
    pending = repository.get_evidencia("aviso-1", "ev-1")
    assert pending is not None
    assert pending.estado == "pendiente_carga"
    assert pending.tamano == 1200

    repository.update_evidencia(_evidencia("aviso-1", "ev-1", "disponible"))
    ready = repository.get_evidencia("aviso-1", "ev-1")
    assert ready is not None
    assert ready.estado == "disponible"
    assert ready.url.startswith("s3://solventa-evidencias/avisos/")
    assert [item.id for item in repository.list_evidencias("aviso-1")] == ["ev-1"]


def test_el_conteo_ignora_rechazadas(repository):
    repository.add_aviso(_aviso())
    repository.add_evidencia(_evidencia("aviso-1", "ev-ok", "disponible"))
    repository.add_evidencia(_evidencia("aviso-1", "ev-no", "rechazada"))
    assert repository.count_activas("aviso-1") == 1
