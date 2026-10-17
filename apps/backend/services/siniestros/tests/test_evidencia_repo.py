import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from siniestros.avisos.adapters.repository import PostgresAvisoRepository, avisos, evidencias
from siniestros.avisos.domain.models import Aviso, Evidencia
from sqlalchemy import create_engine, delete, inspect

# Ids these tests insert. A previous run may have left them committed.
_TEST_AVISO_IDS = {"aviso-1", "aviso-2"}


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


def _purge(engine, aviso_ids: set[str]) -> None:
    if not aviso_ids:
        return
    with engine.begin() as conn:
        conn.execute(delete(evidencias).where(evidencias.c.aviso_id.in_(aviso_ids)))
        conn.execute(delete(avisos).where(avisos.c.id.in_(aviso_ids)))


@pytest.fixture(params=_params())
def repository(request):
    if request.param is None:
        pytest.skip("DB_HOST no está definido")
    engine = create_engine(request.param)
    repo = PostgresAvisoRepository(engine)
    repo.create_schema()
    inserted: set[str] = set()
    add_aviso = repo.add_aviso
    add_evidencia = repo.add_evidencia

    def tracking_add_aviso(aviso: Aviso) -> None:
        inserted.add(aviso.id)
        add_aviso(aviso)

    def tracking_add_evidencia(evidencia: Evidencia) -> None:
        inserted.add(evidencia.aviso_id)
        add_evidencia(evidencia)

    repo.add_aviso = tracking_add_aviso
    repo.add_evidencia = tracking_add_evidencia
    _purge(engine, set(_TEST_AVISO_IDS))
    try:
        yield repo
    finally:
        _purge(engine, inserted | _TEST_AVISO_IDS)
        engine.dispose()


def _aviso(aviso_id: str = "aviso-1") -> Aviso:
    return Aviso(
        id=aviso_id,
        cliente_id="cliente-1",
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


def test_el_listado_trae_solo_los_avisos_del_cliente(repository):
    cliente = f"cliente-{uuid4()}"
    propio = _aviso().model_copy(update={"cliente_id": cliente})
    ajeno = _aviso("aviso-2").model_copy(update={"cliente_id": f"cliente-{uuid4()}"})
    repository.add_aviso(propio)
    repository.add_aviso(ajeno)

    listed = repository.list_avisos(cliente)

    assert [item.id for item in listed] == [propio.id]


def test_radicar_actualiza_el_estado(repository):
    saved = _aviso()
    repository.add_aviso(saved)
    repository.update_aviso(saved.model_copy(update={"estado": "radicado"}))

    loaded = repository.get_aviso(saved.id)

    assert loaded is not None
    assert loaded.estado == "radicado"


def test_un_borrador_se_lee_por_id(repository):
    saved = _aviso()
    repository.add_aviso(saved)
    loaded = repository.get_aviso(saved.id)
    assert loaded is not None
    assert loaded.cliente_id == saved.cliente_id
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
