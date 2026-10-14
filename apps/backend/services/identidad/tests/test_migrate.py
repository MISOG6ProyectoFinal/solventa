"""La migración de nombre se corre a mano. El arranque del servicio no la ejecuta."""

from unittest.mock import MagicMock, patch

import pytest
from identidad.kyc.migrate import main, migrate
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool


def _engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def _tabla_anterior(engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE clientes ("
                "id VARCHAR(36) PRIMARY KEY, "
                "correo VARCHAR(254) NOT NULL UNIQUE, "
                "password_hash VARCHAR(64) NOT NULL, "
                "salt VARCHAR(32) NOT NULL)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO clientes (id, correo, password_hash, salt) "
                "VALUES ('c1', 'viejo@solventa.test', 'hash', 'salt')"
            )
        )


def test_la_migracion_agrega_el_nombre_conserva_la_fila_y_se_puede_repetir():
    engine = _engine()
    _tabla_anterior(engine)

    migrate(engine)
    migrate(engine)

    with engine.connect() as conn:
        row = conn.execute(text("SELECT nombre, apellido FROM clientes")).mappings().one()
    assert row["nombre"] == ""
    assert row["apellido"] == ""
    columnas = {column["name"] for column in inspect(engine).get_columns("clientes")}
    assert {"nombre", "apellido"} <= columnas


def test_sin_tabla_la_migracion_no_crea_nada():
    engine = _engine()

    migrate(engine)

    assert inspect(engine).has_table("clientes") is False


def test_main_exige_base_de_datos():
    with patch("identidad.kyc.migrate.settings") as settings, pytest.raises(SystemExit):
        settings.database_url = None
        main()


@patch("identidad.kyc.migrate.migrate")
@patch("identidad.kyc.migrate.build_engine")
@patch("identidad.kyc.migrate.settings")
def test_main_ejecuta_la_migracion_con_el_engine(settings, build_engine, migrate_fn):
    settings.database_url = "postgresql+psycopg://solventa:solventa@localhost/identidad"
    build_engine.return_value = MagicMock()

    main()

    build_engine.assert_called_once_with(settings.database_url)
    migrate_fn.assert_called_once_with(build_engine.return_value)
