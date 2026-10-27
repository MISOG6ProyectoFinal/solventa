"""Las credenciales viven en la tabla cuentas, separadas de los datos de la persona."""

import pytest
from identidad.kyc.adapters.account_repository import InMemoryAccountRepository, PostgresAccountRepository
from identidad.kyc.adapters.repository import PostgresClientRepository
from identidad.kyc.domain.models import Account, Client
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.pool import StaticPool


def _engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


@pytest.mark.parametrize("make", [lambda e: PostgresAccountRepository(e), lambda e: InMemoryAccountRepository()])
def test_la_cuenta_se_guarda_por_cliente_y_se_recupera(make):
    repo = make(_engine())
    repo.create_schema()

    repo.add(Account(client_id="c1", password_hash="a" * 64, salt="b" * 32))

    assert repo.get("c1") == Account(client_id="c1", password_hash="a" * 64, salt="b" * 32)
    assert repo.get("otro") is None


def test_un_cliente_solo_tiene_una_cuenta():
    repo = PostgresAccountRepository(_engine())
    repo.create_schema()
    repo.add(Account(client_id="c1", password_hash="a" * 64, salt="b" * 32))

    with pytest.raises(ValueError):
        repo.add(Account(client_id="c1", password_hash="c" * 64, salt="d" * 32))


def test_la_tabla_de_clientes_ya_no_guarda_credenciales():
    engine = _engine()
    PostgresClientRepository(engine).create_schema()

    columnas = {column["name"] for column in inspect(engine).get_columns("clientes")}

    assert {"password_hash", "salt"}.isdisjoint(columnas)


def test_el_numero_de_documento_es_unico_pero_varios_clientes_pueden_no_tenerlo():
    repo = PostgresClientRepository(_engine())
    repo.create_schema()
    repo.add(Client(id="c1", email="a@solventa.test", nombre="A", numero_documento="100"))
    repo.add(Client(id="c2", email="b@solventa.test", nombre="B"))
    repo.add(Client(id="c3", email="c@solventa.test", nombre="C"))

    with pytest.raises(ValueError):
        repo.add(Client(id="c4", email="d@solventa.test", nombre="D", numero_documento="100"))

    assert repo.get_by_numero_documento("100").id == "c1"
    assert repo.get_by_numero_documento("999") is None


def test_una_cuenta_exige_que_el_cliente_exista():
    engine = _engine()
    event.listen(engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
    clientes = PostgresClientRepository(engine)
    cuentas = PostgresAccountRepository(engine)
    clientes.create_schema()
    cuentas.create_schema()
    clientes.add(Client(id="c1", email="a@solventa.test", nombre="A"))

    cuentas.add(Account(client_id="c1", password_hash="a" * 64, salt="b" * 32))
    with pytest.raises(ValueError):
        cuentas.add(Account(client_id="fantasma", password_hash="a" * 64, salt="b" * 32))
