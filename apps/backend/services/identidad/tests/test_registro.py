from fastapi.testclient import TestClient
from identidad.container import container
from identidad.main import app
from solventa_common.sesion import verify_token

client = TestClient(app)

CORREO = "cliente@solventa.test"
CONTRASENA = "solventa-local"
NUEVO = {"correo": "nueva@solventa.test", "contrasena": "clave-nueva"}
DUPLICADO = "Ya existe una cuenta con este correo."


def test_registro_crea_la_cuenta_e_inicia_sesion():
    creado = client.post("/identidad/clientes", json=NUEVO)

    assert creado.status_code == 201
    body = creado.json()
    assert set(body) == {"token", "cliente_id"}
    payload = verify_token(body["token"], container.secret)
    assert payload.client_id == body["cliente_id"]
    assert payload.email == NUEVO["correo"]

    ingreso = client.post("/identidad/sesiones", json=NUEVO)
    assert ingreso.status_code == 200
    assert ingreso.json()["cliente_id"] == body["cliente_id"]


def test_registro_de_un_correo_existente_responde_409():
    alta = client.post("/identidad/clientes", json={"correo": CORREO, "contrasena": CONTRASENA})
    assert alta.status_code == 201

    response = client.post("/identidad/clientes", json={"correo": CORREO, "contrasena": CONTRASENA})

    assert response.status_code == 409
    assert response.json()["detail"] == DUPLICADO


def test_registro_trata_el_correo_sin_importar_mayusculas():
    alta = client.post("/identidad/clientes", json={"correo": "Otra@Solventa.test", "contrasena": "clave-nueva"})
    assert alta.status_code == 201

    duplicado = client.post("/identidad/clientes", json={"correo": "otra@solventa.test", "contrasena": "otra-clave"})

    assert duplicado.status_code == 409
    assert duplicado.json()["detail"] == DUPLICADO


def test_registro_con_campos_vacios_es_validacion():
    vacio = client.post("/identidad/clientes", json={"correo": "", "contrasena": "clave-nueva"})
    espacios = client.post("/identidad/clientes", json={"correo": "nueva2@solventa.test", "contrasena": "  "})
    sin_campos = client.post("/identidad/clientes", json={})

    assert vacio.status_code == 422
    assert espacios.status_code == 422
    assert sin_campos.status_code == 422
