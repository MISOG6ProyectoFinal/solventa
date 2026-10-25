from itertools import count

from fastapi.testclient import TestClient
from identidad.container import container
from identidad.main import app
from solventa_common.sesion import verify_token
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

client = TestClient(app)

CORREO = "acceso@solventa.test"
CONTRASENA = "solventa-local"
DETALLE = "Correo o contraseña incorrectos"

_documentos = count(2_000_000)


def personales() -> dict:
    return {
        "tipo_documento": "CC",
        "numero_documento": str(next(_documentos)),
        "telefono": "3001234567",
        "fecha_nacimiento": "1990-05-20",
    }


def _sqlite():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def test_cliente_registrado_recibe_token_y_cliente_id():
    alta = client.post(
        "/identidad/clientes",
        json={"correo": CORREO, "contrasena": CONTRASENA, "nombre": "Ana", "apellido": "Rojas", **personales()},
    )
    assert alta.status_code == 201

    response = client.post("/identidad/sesiones", json={"correo": CORREO, "contrasena": CONTRASENA})

    assert response.status_code == 200
    body = response.json()
    assert body["cliente_id"]
    payload = verify_token(body["token"], container.secret)
    assert payload.client_id == body["cliente_id"]
    assert payload.email == CORREO


def test_contrasena_incorrecta_y_correo_desconocido_responden_igual():
    correo = "existe@solventa.test"
    assert (
        client.post(
            "/identidad/clientes",
            json={"correo": correo, "contrasena": CONTRASENA, "nombre": "Ana", "apellido": "Rojas", **personales()},
        ).status_code
        == 201
    )
    desconocido = client.post(
        "/identidad/sesiones",
        json={"correo": "nadie@solventa.test", "contrasena": CONTRASENA},
    )
    incorrecta = client.post(
        "/identidad/sesiones",
        json={"correo": correo, "contrasena": "otra-contrasena"},
    )

    assert desconocido.status_code == 401
    assert incorrecta.status_code == 401
    assert desconocido.json() == incorrecta.json()
    assert desconocido.json()["detail"] == DETALLE


def test_campos_vacios_son_validacion():
    assert client.post("/identidad/sesiones", json={"correo": "", "contrasena": CONTRASENA}).status_code == 422
    assert client.post("/identidad/sesiones", json={"correo": "  ", "contrasena": CONTRASENA}).status_code == 422
    assert client.post("/identidad/sesiones", json={"correo": CORREO, "contrasena": ""}).status_code == 422
    assert client.post("/identidad/sesiones", json={}).status_code == 422


def test_cliente_guardado_en_la_base_puede_iniciar_sesion():
    engine = _sqlite()
    container.use_postgres(engine)
    container.use_postgres(engine)
    cuenta = {"correo": "guardado@solventa.test", "contrasena": CONTRASENA}
    registro = {**cuenta, "nombre": "Ana", "apellido": "Rojas", **personales()}
    try:
        assert client.post("/identidad/sesiones", json=cuenta).status_code == 401
        assert client.post("/identidad/clientes", json=registro).status_code == 201
        response = client.post("/identidad/sesiones", json=cuenta)
        assert response.status_code == 200
        assert response.json()["cliente_id"]
    finally:
        container.use_memory()
