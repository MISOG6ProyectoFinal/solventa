"""La migración de clientes anteriores corre como init container del Deployment, no dentro del servicio."""

import os
import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest
from identidad.kyc.adapters.account_repository import PostgresAccountRepository
from identidad.kyc.adapters.repository import PostgresClientRepository
from identidad.kyc.domain.models import Account, Client
from identidad.kyc.migrate import main, migrate
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool


def _engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def _tabla_anterior(engine) -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE clientes (id VARCHAR(36) PRIMARY KEY, correo VARCHAR(254) NOT NULL UNIQUE)"))
        conn.execute(text("INSERT INTO clientes (id, correo) VALUES ('c1', 'viejo@solventa.test')"))


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


def test_un_cliente_anterior_conserva_su_correo_como_email_y_puede_iniciar_sesion():
    engine = _engine()
    _tabla_anterior(engine)

    migrate(engine)

    assert PostgresClientRepository(engine).get_by_email("viejo@solventa.test").id == "c1"


def test_la_migracion_completa_las_columnas_que_el_registro_necesita():
    engine = _engine()
    _tabla_anterior(engine)

    migrate(engine)

    columnas = {column["name"] for column in inspect(engine).get_columns("clientes")}
    assert {
        "email",
        "tipo_documento",
        "numero_documento",
        "telefono",
        "fecha_nacimiento",
    } <= columnas


def test_tras_migrar_se_registra_un_cliente_nuevo_y_no_se_repite_el_email():
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE clientes (id VARCHAR(36) PRIMARY KEY, correo VARCHAR(254) UNIQUE)"))
    migrate(engine)
    repo = PostgresClientRepository(engine)

    repo.add(Client(id="c2", email="nuevo@solventa.test", nombre="Ana Perez"))

    assert repo.get_by_email("nuevo@solventa.test").id == "c2"
    with pytest.raises(ValueError):
        repo.add(Client(id="c3", email="nuevo@solventa.test", nombre="Otra"))


def _tabla_con_credenciales(engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE clientes (id VARCHAR(36) PRIMARY KEY, correo VARCHAR(254) UNIQUE, "
                "password_hash VARCHAR(64), salt VARCHAR(32))"
            )
        )
        conn.execute(
            text("INSERT INTO clientes VALUES ('c1', 'a@solventa.test', :h, :s)"),
            {"h": "a" * 64, "s": "b" * 32},
        )
        conn.execute(text("INSERT INTO clientes VALUES ('c2', 'b@solventa.test', '', '')"))
        conn.execute(text("INSERT INTO clientes VALUES ('c3', 'c@solventa.test', NULL, NULL)"))


def test_la_migracion_copia_las_credenciales_a_cuentas_y_se_puede_repetir():
    engine = _engine()
    _tabla_con_credenciales(engine)

    migrate(engine)
    migrate(engine)

    cuentas = PostgresAccountRepository(engine)
    assert cuentas.get("c1") == Account(client_id="c1", password_hash="a" * 64, salt="b" * 32)
    assert cuentas.get("c2") is None
    assert cuentas.get("c3") is None


def test_la_migracion_hace_unico_el_documento_sin_chocar_con_los_vacios():
    engine = _engine()
    _tabla_con_credenciales(engine)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE clientes ADD COLUMN numero_documento VARCHAR(30)"))
        conn.execute(text("UPDATE clientes SET numero_documento = ''"))

    migrate(engine)

    repo = PostgresClientRepository(engine)
    repo.add(Client(id="c9", email="z@solventa.test", nombre="Z", numero_documento="100"))
    with pytest.raises(ValueError):
        repo.add(Client(id="c10", email="y@solventa.test", nombre="Y", numero_documento="100"))
    assert repo.get_by_email("a@solventa.test").numero_documento == ""


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
    settings.database_url = "postgresql+psycopg://localhost/identidad"
    build_engine.return_value = MagicMock()

    main()

    build_engine.assert_called_once_with(settings.database_url)
    migrate_fn.assert_called_once_with(build_engine.return_value)


def test_la_migracion_arranca_sin_el_secreto_de_sesion(tmp_path):
    env = {k: v for k, v in os.environ.items() if k not in ("SESION_SECRETO", "DB_HOST", "DB_NAME")}
    env["PYTHONPATH"] = os.pathsep.join(sys.path)

    result = subprocess.run(
        [sys.executable, "-m", "identidad.kyc.migrate"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert "La migración necesita DB_HOST y DB_NAME" in result.stderr
    assert "sesion_secreto" not in result.stderr
