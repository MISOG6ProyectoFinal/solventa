from fastapi.testclient import TestClient
from identidad.container import container
from identidad.main import app
from solventa_common.sesion import verify_token

client = TestClient(app)

CORREO = "cliente@solventa.test"
CONTRASENA = "solventa-local"
NUEVO = {
    "correo": "nueva@solventa.test",
    "contrasena": "clave-nueva",
    "nombre": "Ana",
    "apellido": "Rojas",
}
DUPLICADO = "Ya existe una cuenta con este correo."


def test_registro_crea_la_cuenta_e_inicia_sesion():
    creado = client.post("/identidad/clientes", json=NUEVO)

    assert creado.status_code == 201
    body = creado.json()
    assert set(body) == {"token", "cliente_id"}
    payload = verify_token(body["token"], container.secret)
    assert payload.client_id == body["cliente_id"]
    assert payload.email == NUEVO["correo"]
    assert payload.first_name == "Ana"
    assert payload.last_name == "Rojas"

    ingreso = client.post("/identidad/sesiones", json=NUEVO)
    assert ingreso.status_code == 200
    assert ingreso.json()["cliente_id"] == body["cliente_id"]


def test_registro_guarda_el_nombre_recortado_y_el_ingreso_lo_conserva():
    cuenta = {
        "correo": "ana@solventa.test",
        "contrasena": CONTRASENA,
        "nombre": "  Ana  ",
        "apellido": "  Rojas  ",
    }
    alta = client.post("/identidad/clientes", json=cuenta)
    assert alta.status_code == 201
    creado = verify_token(alta.json()["token"], container.secret)
    assert creado.first_name == "Ana"
    assert creado.last_name == "Rojas"

    ingreso = client.post(
        "/identidad/sesiones",
        json={"correo": cuenta["correo"], "contrasena": cuenta["contrasena"]},
    )
    assert ingreso.status_code == 200
    sesion = verify_token(ingreso.json()["token"], container.secret)
    assert sesion.first_name == "Ana"
    assert sesion.last_name == "Rojas"


def test_registro_de_un_correo_existente_responde_409():
    alta = client.post(
        "/identidad/clientes",
        json={"correo": CORREO, "contrasena": CONTRASENA, "nombre": "Ana", "apellido": "Rojas"},
    )
    assert alta.status_code == 201

    response = client.post(
        "/identidad/clientes",
        json={"correo": CORREO, "contrasena": CONTRASENA, "nombre": "Otra", "apellido": "Persona"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == DUPLICADO


def test_registro_trata_el_correo_sin_importar_mayusculas():
    alta = client.post(
        "/identidad/clientes",
        json={"correo": "Otra@Solventa.test", "contrasena": "clave-nueva", "nombre": "Ana", "apellido": "Rojas"},
    )
    assert alta.status_code == 201

    duplicado = client.post(
        "/identidad/clientes",
        json={"correo": "otra@solventa.test", "contrasena": "otra-clave", "nombre": "Ana", "apellido": "Rojas"},
    )

    assert duplicado.status_code == 409
    assert duplicado.json()["detail"] == DUPLICADO


def test_registro_con_campos_vacios_es_validacion():
    vacio = client.post("/identidad/clientes", json={"correo": "", "contrasena": "clave-nueva"})
    espacios = client.post("/identidad/clientes", json={"correo": "nueva2@solventa.test", "contrasena": "  "})
    sin_campos = client.post("/identidad/clientes", json={})

    sin_nombre = client.post(
        "/identidad/clientes",
        json={"correo": "nueva3@solventa.test", "contrasena": CONTRASENA, "nombre": "  ", "apellido": "Rojas"},
    )
    sin_apellido = client.post(
        "/identidad/clientes",
        json={"correo": "nueva4@solventa.test", "contrasena": CONTRASENA, "nombre": "Ana", "apellido": ""},
    )

    assert vacio.status_code == 422
    assert espacios.status_code == 422
    assert sin_campos.status_code == 422
    assert sin_nombre.status_code == 422
    assert sin_apellido.status_code == 422


def test_registro_colision_concurrente_en_add_responde_409():
    from unittest.mock import patch

    with patch.object(container.clients, "add", side_effect=ValueError("colision@solventa.test")):
        response = client.post(
            "/identidad/clientes",
            json={"correo": "colision@solventa.test", "contrasena": CONTRASENA, "nombre": "Ana", "apellido": "Rojas"},
        )
        assert response.status_code == 409
        assert response.json()["detail"] == DUPLICADO
