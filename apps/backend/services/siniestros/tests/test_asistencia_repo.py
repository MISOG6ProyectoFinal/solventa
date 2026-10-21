from datetime import UTC, datetime

import pytest
from siniestros.asistencia.adapters.memory import InMemoryAsistenciaRepository
from siniestros.asistencia.adapters.repository import PostgresAsistenciaRepository
from siniestros.asistencia.domain.errors import ReglaAsistencia
from siniestros.asistencia.domain.models import Asistencia
from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool


def _asistencia(aviso_id: str = "aviso-1", numero: str = "AST-1111") -> Asistencia:
    return Asistencia(
        id=f"id-{aviso_id}",
        aviso_id=aviso_id,
        cliente_id="cliente-1",
        servicio="grua",
        ubicacion="Calle 85 #12-34",
        gps=None,
        numero=numero,
        eta_min=25,
        eta_max=40,
        estado="solicitada",
        solicitada_en=datetime(2026, 10, 1, 12, 0, tzinfo=UTC),
    )


@pytest.fixture(params=["memory", "sqlite"])
def repository(request):
    if request.param == "memory":
        return InMemoryAsistenciaRepository()
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    repo = PostgresAsistenciaRepository(engine)
    repo.create_schema()
    return repo


def test_guarda_y_lee_por_aviso_y_por_numero(repository):
    repository.add(_asistencia())

    assert repository.get_by_aviso("aviso-1") == _asistencia()
    assert repository.get_by_numero("AST-1111") == _asistencia()
    assert repository.get_by_aviso("otro") is None
    assert repository.get_by_numero("AST-9999") is None


def test_un_aviso_no_admite_dos_solicitudes(repository):
    repository.add(_asistencia())

    with pytest.raises(ReglaAsistencia) as error:
        repository.add(_asistencia(numero="AST-2222"))

    assert error.value.status == 409


def test_create_schema_crea_la_tabla():
    engine = create_engine("sqlite://")
    PostgresAsistenciaRepository(engine).create_schema()

    assert "asistencias" in inspect(engine).get_table_names()
