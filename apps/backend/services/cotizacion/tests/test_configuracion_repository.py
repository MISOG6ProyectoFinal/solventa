"""El repositorio SQL de la configuración por socio contra SQLite en memoria."""

from datetime import UTC, datetime

import pytest
from cotizacion.gobierno_socios.adapters.configuracion_repository import PostgresConfiguracionRepository
from cotizacion.gobierno_socios.domain.configuracion import ConfiguracionSocio, RamoHabilitado
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool


@pytest.fixture
def repo() -> PostgresConfiguracionRepository:
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    repository = PostgresConfiguracionRepository(engine)
    repository.create_schema()
    return repository


def configuracion(socio_id: str, *ramos: RamoHabilitado, usuario: str = "Ana Gómez") -> ConfiguracionSocio:
    return ConfiguracionSocio(
        socio_id=socio_id,
        ramos=list(ramos),
        actualizado_en=datetime(2026, 10, 1, 9, 0, tzinfo=UTC),
        actualizado_por=usuario,
    )


def test_socio_sin_configuracion_devuelve_none(repo):
    assert repo.get("s-1") is None
    assert repo.ramos_por_socio() == {}


def test_guarda_y_recupera_ramos_con_sus_coberturas(repo):
    repo.save(
        configuracion(
            "s-1",
            RamoHabilitado(ramo_id="ramo-viaje", coberturas=["viaje-cancelacion", "viaje-equipaje"]),
            RamoHabilitado(ramo_id="ramo-dispositivos"),
        )
    )

    guardada = repo.get("s-1")

    assert {r.ramo_id: r.coberturas for r in guardada.ramos} == {
        "ramo-viaje": ["viaje-cancelacion", "viaje-equipaje"],
        "ramo-dispositivos": [],
    }
    assert guardada.actualizado_por == "Ana Gómez"
    assert guardada.ramos_habilitados() == {"ramo-viaje", "ramo-dispositivos"}


def test_guardar_reemplaza_la_configuracion_anterior(repo):
    repo.save(configuracion("s-1", RamoHabilitado(ramo_id="ramo-viaje", coberturas=["viaje-cancelacion"])))

    repo.save(configuracion("s-1", RamoHabilitado(ramo_id="ramo-parametrico"), usuario="Carlos Ruiz"))

    guardada = repo.get("s-1")
    assert [r.ramo_id for r in guardada.ramos] == ["ramo-parametrico"]
    assert guardada.actualizado_por == "Carlos Ruiz"


def test_configuracion_sin_ramos_conserva_la_traza(repo):
    repo.save(configuracion("s-1", RamoHabilitado(ramo_id="ramo-viaje")))

    repo.save(configuracion("s-1", usuario="Carlos Ruiz"))

    guardada = repo.get("s-1")
    assert guardada.ramos == []
    assert guardada.actualizado_por == "Carlos Ruiz"


def test_cada_socio_conserva_su_propia_configuracion(repo):
    repo.save(configuracion("s-1", RamoHabilitado(ramo_id="ramo-viaje")))
    repo.save(configuracion("s-2", RamoHabilitado(ramo_id="ramo-parametrico")))

    repo.save(configuracion("s-1", RamoHabilitado(ramo_id="ramo-dispositivos")))

    assert repo.ramos_por_socio() == {"s-1": ["ramo-dispositivos"], "s-2": ["ramo-parametrico"]}
