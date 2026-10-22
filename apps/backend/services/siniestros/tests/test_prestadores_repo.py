import os

import pytest
from siniestros.prestadores.adapters.memory import InMemoryPrestadorRepository
from siniestros.prestadores.adapters.postgis import PostgisPrestadorRepository
from siniestros.prestadores.adapters.seed_catalog import SeedCatalog
from siniestros.prestadores.domain.models import ConsultaCercanos
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

CONSULTAS = [
    ConsultaCercanos(lat=4.711, lon=-74.0721),
    ConsultaCercanos(lat=4.711, lon=-74.0721, radio_km=3),
    ConsultaCercanos(lat=4.711, lon=-74.0721, radio_km=50, servicio="grua"),
    ConsultaCercanos(lat=4.6097, lon=-74.0817, radio_km=5, servicio="ambulancia"),
    ConsultaCercanos(lat=-33.45, lon=-70.66),
]


def _postgres_url() -> str | None:
    host = os.getenv("DB_HOST")
    if not host:
        return None
    user = os.environ["DB_USER"]
    password = os.environ["DB_PASSWORD"]
    name = os.environ["DB_NAME"]
    port = os.getenv("DB_PORT", "5432")
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}"


@pytest.fixture
def postgis():
    url = _postgres_url()
    if url is None:
        pytest.skip("DB_HOST no está definido")
    engine = create_engine(url)
    repo = PostgisPrestadorRepository(engine)
    try:
        repo.create_schema()
    except SQLAlchemyError:
        pytest.skip("La base no tiene la extensión PostGIS")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM prestadores"))
    yield repo
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM prestadores"))


@pytest.mark.parametrize("consulta", CONSULTAS)
def test_postgis_devuelve_lo_mismo_que_el_repositorio_en_memoria(postgis, consulta):
    seed = SeedCatalog().fetch()
    memory = InMemoryPrestadorRepository()
    memory.upsert(seed)
    postgis.upsert(seed)

    esperado = memory.cercanos(consulta)
    obtenido = postgis.cercanos(consulta)

    assert [p.origen_id for p, _ in obtenido] == [p.origen_id for p, _ in esperado]
    for (_, distancia_pg), (_, distancia_mem) in zip(obtenido, esperado, strict=True):
        assert distancia_pg == pytest.approx(distancia_mem, rel=0.01, abs=0.02)


def test_postgis_upsert_repetido_deja_una_fila_por_origen_y_origen_id(postgis):
    seed = SeedCatalog().fetch()

    postgis.upsert(seed)
    postgis.upsert(seed)

    total = postgis.cercanos(ConsultaCercanos(lat=4.711, lon=-74.0721, radio_km=50))
    assert len(total) == len(seed)
