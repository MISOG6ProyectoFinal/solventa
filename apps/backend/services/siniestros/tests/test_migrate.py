"""La migración de cliente_id se corre a mano. El arranque del servicio no la ejecuta."""

from unittest.mock import MagicMock, patch

import pytest
from siniestros.avisos.migrate import main, migrate
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool


def _engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def _tabla_anterior(engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE avisos ("
                "id VARCHAR(64) PRIMARY KEY, "
                "poliza_id VARCHAR(64) NOT NULL, "
                "tipo VARCHAR(64) NOT NULL, "
                "ocurrido_en DATETIME NOT NULL, "
                "descripcion VARCHAR NOT NULL, "
                "ubicacion VARCHAR(255), "
                "estado VARCHAR(32) NOT NULL, "
                "creado_en DATETIME NOT NULL)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO avisos (id, poliza_id, tipo, ocurrido_en, descripcion, ubicacion, estado, creado_en) "
                "VALUES ('viejo', 'POL-1', 'choque', '2026-10-01 12:00:00', 'Golpe', NULL, 'borrador', "
                "'2026-10-01 12:00:00')"
            )
        )


def test_la_migracion_agrega_cliente_id_conserva_la_fila_y_se_puede_repetir():
    engine = _engine()
    _tabla_anterior(engine)

    migrate(engine)
    migrate(engine)

    with engine.connect() as conn:
        row = conn.execute(text("SELECT cliente_id FROM avisos")).mappings().one()
    assert row["cliente_id"] == ""
    columnas = {column["name"] for column in inspect(engine).get_columns("avisos")}
    assert "cliente_id" in columnas


def test_sin_tabla_la_migracion_no_crea_nada():
    engine = _engine()

    migrate(engine)

    assert inspect(engine).has_table("avisos") is False


def test_main_exige_base_de_datos():
    with patch("siniestros.avisos.migrate.settings") as settings, pytest.raises(SystemExit):
        settings.database_url = None
        main()


@patch("siniestros.avisos.migrate.migrate")
@patch("siniestros.avisos.migrate.build_engine")
@patch("siniestros.avisos.migrate.settings")
def test_main_ejecuta_la_migracion_con_el_engine(settings, build_engine, migrate_fn):
    settings.database_url = "postgresql+psycopg://localhost/siniestros"
    build_engine.return_value = MagicMock()

    main()

    build_engine.assert_called_once_with(settings.database_url)
    migrate_fn.assert_called_once_with(build_engine.return_value)
