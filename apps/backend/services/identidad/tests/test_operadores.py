"""Operadores del portal: sesión, alta, listado y cambios."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from identidad.config import settings
from identidad.container import container
from identidad.main import app
from identidad.operadores.adapters.repository import InMemoryOperatorRepository, PostgresOperatorRepository
from identidad.operadores.domain.models import EmailTaken, NewOperator, Operator
from identidad.operadores.domain.use_cases import CreateOperator
from solventa_common.operator_session import ADMIN, ADVISOR, VIEWER, verify_operator_token
from solventa_common.sesion import InvalidToken
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

client = TestClient(app)

CORREO = "ana@solventa.test"
CONTRASENA = "clave-segura-1"


@pytest.fixture(autouse=True)
def fresh_operators():
    container.use_memory()
    yield
    container.use_memory()


def _sqlite():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def _create(correo=CORREO, roles=None, contrasena=CONTRASENA, nombre="Ana Rojas"):
    return client.post(
        "/identidad/operadores",
        json={"correo": correo, "nombre": nombre, "roles": roles or [ADVISOR], "contrasena": contrasena},
    )


def _login(correo=CORREO, contrasena=CONTRASENA):
    return client.post("/identidad/operadores/sesiones", json={"correo": correo, "contrasena": contrasena})


def _operator(correo="a@solventa.test", creado_en=None, **changes) -> Operator:
    data = {
        "id": f"id-{correo}",
        "correo": correo,
        "nombre": "Operador",
        "roles": [ADVISOR, VIEWER],
        "password_hash": "a" * 64,
        "salt": "b" * 32,
        "creado_en": creado_en or datetime.now(UTC),
    }
    return Operator(**{**data, **changes})


def test_inicio_de_sesion_devuelve_token_verificable_con_los_roles():
    _create(roles=[ADMIN, VIEWER])

    response = _login()

    assert response.status_code == 200
    body = response.json()
    token = verify_operator_token(body["token"], settings.sesion_secreto)
    assert token.email == CORREO
    assert token.name == "Ana Rojas"
    assert set(token.roles) == {ADMIN, VIEWER}
    assert body["operador"]["correo"] == CORREO
    assert body["operador"]["roles"] == [ADMIN, VIEWER]
    assert "password_hash" not in body["operador"]
    assert "salt" not in body["operador"]


def test_el_correo_del_inicio_de_sesion_no_distingue_mayusculas():
    _create()

    assert _login(correo="ANA@Solventa.test").status_code == 200


def test_el_token_del_operador_expira_a_las_ocho_horas():
    _create()
    token = _login().json()["token"]
    ahora = datetime.now(UTC)

    verify_operator_token(token, settings.sesion_secreto, now=ahora + timedelta(hours=7))
    with pytest.raises(InvalidToken):
        verify_operator_token(token, settings.sesion_secreto, now=ahora + timedelta(hours=9))


@pytest.mark.parametrize(
    ("correo", "contrasena"),
    [(CORREO, "clave-equivocada"), ("nadie@solventa.test", CONTRASENA)],
)
def test_credenciales_incorrectas_responden_401_igual(correo, contrasena):
    _create()

    response = _login(correo, contrasena)

    assert response.status_code == 401
    assert response.json()["detail"] == {
        "codigo": "credenciales_invalidas",
        "mensaje": "Correo o contraseña incorrectos.",
    }


def test_un_operador_inactivo_no_inicia_sesion():
    operador = _create().json()
    client.patch(f"/identidad/operadores/{operador['id']}", json={"activo": False})

    response = _login()

    assert response.status_code == 401
    assert response.json()["detail"]["codigo"] == "credenciales_invalidas"


def test_crear_operador_responde_201_sin_hash_ni_sal():
    response = _create(correo="  Ana@Solventa.test ")

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "correo", "nombre", "roles", "activo", "creado_en"}
    assert body["correo"] == CORREO
    assert body["activo"] is True
    assert body["roles"] == [ADVISOR]


def test_correo_duplicado_responde_409():
    _create()

    response = _create(nombre="Otra Persona")

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "codigo": "correo_registrado",
        "mensaje": "Ya existe un operador con este correo.",
    }


@pytest.mark.parametrize(
    "changes",
    [
        {"roles": ["superusuario"]},
        {"roles": []},
        {"roles": [ADMIN, ADMIN]},
        {"contrasena": "corta"},
        {"correo": "no-es-un-correo"},
        {"nombre": "   "},
    ],
)
def test_datos_invalidos_responden_422(changes):
    valid = {"correo": CORREO, "nombre": "Ana", "roles": [ADVISOR], "contrasena": CONTRASENA}

    response = client.post("/identidad/operadores", json={**valid, **changes})

    assert response.status_code == 422


def test_listar_no_expone_hash_ni_sal():
    _create()
    _create(correo="luis@solventa.test", roles=[VIEWER], nombre="Luis")

    response = client.get("/identidad/operadores")

    assert response.status_code == 200
    operadores = response.json()
    assert [operador["correo"] for operador in operadores] == [CORREO, "luis@solventa.test"]
    for operador in operadores:
        assert set(operador) == {"id", "correo", "nombre", "roles", "activo", "creado_en"}
    assert "password_hash" not in response.text
    assert "salt" not in response.text


def test_actualizar_roles_y_estado():
    operador = _create().json()

    cambio_roles = client.patch(f"/identidad/operadores/{operador['id']}", json={"roles": [ADMIN, VIEWER]})
    cambio_estado = client.patch(f"/identidad/operadores/{operador['id']}", json={"activo": False})

    assert cambio_roles.status_code == 200
    assert cambio_roles.json()["roles"] == [ADMIN, VIEWER]
    assert cambio_roles.json()["activo"] is True
    assert cambio_estado.status_code == 200
    assert cambio_estado.json()["activo"] is False
    assert cambio_estado.json()["roles"] == [ADMIN, VIEWER]
    assert client.get("/identidad/operadores").json()[0]["activo"] is False


def test_actualizar_con_rol_invalido_responde_422():
    operador = _create().json()

    response = client.patch(f"/identidad/operadores/{operador['id']}", json={"roles": ["otro"]})

    assert response.status_code == 422


def test_actualizar_un_operador_inexistente_responde_404():
    response = client.patch("/identidad/operadores/no-existe", json={"activo": False})

    assert response.status_code == 404
    assert response.json()["detail"] == {"codigo": "operador_no_encontrado", "mensaje": "El operador no existe."}


def test_la_ruta_de_operadores_no_la_captura_el_consentimiento():
    response = client.get("/identidad/operadores")

    assert response.status_code == 200
    assert response.json() == []


def test_el_contenedor_con_postgres_crea_el_esquema_de_operadores():
    container.use_postgres(_sqlite())
    container.use_postgres(container.operators.engine)

    assert container.operators.list() == []


@pytest.mark.parametrize("make", [lambda: PostgresOperatorRepository(_sqlite()), InMemoryOperatorRepository])
def test_repositorio_guarda_busca_lista_y_actualiza(make):
    repo = make()
    repo.create_schema()
    ahora = datetime.now(UTC)
    segundo = _operator("b@solventa.test", ahora + timedelta(minutes=1))
    primero = _operator("a@solventa.test", ahora)

    repo.add(segundo)
    repo.add(primero)

    encontrado = repo.get_by_email("A@Solventa.test")
    assert encontrado is not None
    assert encontrado.id == primero.id
    assert encontrado.roles == [ADVISOR, VIEWER]
    assert encontrado.activo is True
    assert encontrado.creado_en == primero.creado_en
    assert repo.get(segundo.id).correo == "b@solventa.test"
    assert repo.get("otro") is None
    assert repo.get_by_email("nadie@solventa.test") is None
    assert [operador.correo for operador in repo.list()] == ["a@solventa.test", "b@solventa.test"]

    encontrado.roles = [ADMIN]
    encontrado.activo = False
    repo.update(encontrado)

    actualizado = repo.get(primero.id)
    assert actualizado.roles == [ADMIN]
    assert actualizado.activo is False


@pytest.mark.parametrize("make", [lambda: PostgresOperatorRepository(_sqlite()), InMemoryOperatorRepository])
def test_repositorio_rechaza_el_correo_duplicado(make):
    repo = make()
    repo.create_schema()
    repo.add(_operator("a@solventa.test"))

    with pytest.raises(EmailTaken):
        repo.add(_operator("A@solventa.test", id="otro-id"))


def test_crear_operador_directo_rechaza_el_correo_existente():
    repo = InMemoryOperatorRepository()
    use_case = CreateOperator(repo)
    request = NewOperator(correo=CORREO, nombre="Ana", roles=[ADVISOR], contrasena=CONTRASENA)
    use_case.execute(request)

    with pytest.raises(EmailTaken):
        use_case.execute(request)
