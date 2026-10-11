"""El repositorio SQL de socios contra SQLite en memoria."""

from datetime import UTC, datetime

import pytest
from cotizacion.gobierno_socios.adapters.repository import PostgresSocioRepository
from cotizacion.gobierno_socios.domain.models import Alcance, IdentificadorDuplicado, Socio, TipoSocio
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool


@pytest.fixture
def repo() -> PostgresSocioRepository:
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    repository = PostgresSocioRepository(engine)
    repository.create_schema()
    return repository


def socio(**cambios) -> Socio:
    base = {
        "id": "s-1",
        "nombre": "Fintech Demo",
        "identificador": "FINTECH-DEMO",
        "tipo": TipoSocio.FINTECH,
        "pais": "Colombia",
        "correo_contacto": "ops@fintech.demo",
        "alcances": [Alcance.COTIZACION, Alcance.EMISION],
        "client_id": "sv_live_fintechdemo_ab12",
        "secreto_hash": "a" * 64,
        "secreto_enmascarado": "sv_sec_••••••••wxyz",
        "alta_fecha": datetime(2026, 9, 12, 13, 0, tzinfo=UTC),
        "alta_usuario": "Ana Gómez",
    }
    return Socio(**{**base, **cambios})


def test_guarda_y_recupera_el_socio_completo(repo):
    repo.add(socio())

    guardado = repo.get("s-1")

    assert guardado.alcances == [Alcance.COTIZACION, Alcance.EMISION]
    assert guardado.tipo == TipoSocio.FINTECH
    assert guardado.alta_usuario == "Ana Gómez"
    assert guardado.alta_fecha.replace(tzinfo=UTC) == datetime(2026, 9, 12, 13, 0, tzinfo=UTC)
    assert repo.get_by_client_id("sv_live_fintechdemo_ab12").id == "s-1"
    assert [s.id for s in repo.list_socios()] == ["s-1"]


def test_busquedas_sin_resultado_devuelven_none(repo):
    assert repo.get("no-existe") is None
    assert repo.get_by_client_id("no-existe") is None
    assert repo.list_socios() == []


def test_identificador_duplicado_no_deja_filas_parciales(repo):
    repo.add(socio())

    with pytest.raises(IdentificadorDuplicado):
        repo.add(socio(id="s-2", client_id="sv_live_otro_cd34"))

    assert [s.id for s in repo.list_socios()] == ["s-1"]
