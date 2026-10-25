from itertools import count

from fastapi.testclient import TestClient
from identidad.container import container
from identidad.kyc.domain.models import Client
from identidad.main import app
from solventa_common.sesion import verify_token

client = TestClient(app)

CORREO = "cliente@solventa.test"
CONTRASENA = "solventa-local"
_documentos = count(1_000_000)


def personales() -> dict:
    return {
        "tipo_documento": "CC",
        "numero_documento": str(next(_documentos)),
        "telefono": "3001234567",
        "fecha_nacimiento": "1990-05-20",
    }


NUEVO = {
    "correo": "nueva@solventa.test",
    "contrasena": "clave-nueva",
    "nombre": "Ana",
    "apellido": "Rojas",
    **personales(),
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
        **personales(),
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
        json={"correo": CORREO, "contrasena": CONTRASENA, "nombre": "Ana", "apellido": "Rojas", **personales()},
    )
    assert alta.status_code == 201

    response = client.post(
        "/identidad/clientes",
        json={"correo": CORREO, "contrasena": CONTRASENA, "nombre": "Otra", "apellido": "Persona", **personales()},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == DUPLICADO


def test_registro_trata_el_correo_sin_importar_mayusculas():
    alta = client.post(
        "/identidad/clientes",
        json={
            "correo": "Otra@Solventa.test",
            "contrasena": "clave-nueva",
            "nombre": "Ana",
            "apellido": "Rojas",
            **personales(),
        },
    )
    assert alta.status_code == 201

    duplicado = client.post(
        "/identidad/clientes",
        json={
            "correo": "otra@solventa.test",
            "contrasena": "otra-clave",
            "nombre": "Ana",
            "apellido": "Rojas",
            **personales(),
        },
    )

    assert duplicado.status_code == 409
    assert duplicado.json()["detail"] == DUPLICADO


def test_registro_con_campos_vacios_es_validacion():
    vacio = client.post("/identidad/clientes", json={"correo": "", "contrasena": "clave-nueva"})
    espacios = client.post("/identidad/clientes", json={"correo": "nueva2@solventa.test", "contrasena": "  "})
    sin_campos = client.post("/identidad/clientes", json={})

    sin_nombre = client.post(
        "/identidad/clientes",
        json={
            "correo": "nueva3@solventa.test",
            "contrasena": CONTRASENA,
            "nombre": "  ",
            "apellido": "Rojas",
            **personales(),
        },
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


def test_registro_guarda_los_datos_personales_del_cliente():
    alta = client.post(
        "/identidad/clientes", json={**NUEVO, "correo": "datos@solventa.test", "numero_documento": "777001"}
    )

    guardado = container.clients.get(alta.json()["cliente_id"])
    assert guardado.tipo_documento == "CC"
    assert guardado.numero_documento == "777001"
    assert guardado.telefono == "3001234567"
    assert str(guardado.fecha_nacimiento) == "1990-05-20"


def test_registro_exige_cada_dato_personal():
    for campo in personales():
        sin_campo = {k: v for k, v in NUEVO.items() if k != campo}
        vacio = {**NUEVO, campo: "  "}

        assert client.post("/identidad/clientes", json=sin_campo).status_code == 422, campo
        assert client.post("/identidad/clientes", json=vacio).status_code == 422, campo


def test_registro_rechaza_tipo_de_documento_desconocido_y_fecha_futura():
    tipo = {**NUEVO, "tipo_documento": "XX"}
    futura = {**NUEVO, "fecha_nacimiento": "2999-01-01"}
    texto = {**NUEVO, "fecha_nacimiento": "no-es-fecha"}

    assert client.post("/identidad/clientes", json=tipo).status_code == 422
    assert client.post("/identidad/clientes", json=futura).status_code == 422
    assert client.post("/identidad/clientes", json=texto).status_code == 422


def test_registro_acepta_los_tipos_de_documento_del_producto():
    for indice, tipo in enumerate(["CC", "CE", "Pasaporte"]):
        cuenta = {
            **NUEVO,
            "correo": f"tipo{indice}@solventa.test",
            "tipo_documento": tipo,
            "numero_documento": str(888000 + indice),
        }

        assert client.post("/identidad/clientes", json=cuenta).status_code == 201, tipo


DUPLICADO_DOCUMENTO = "Ya existe una cuenta con este documento."


def _cuenta(correo: str, documento: str) -> dict:
    return {**NUEVO, "correo": correo, "numero_documento": documento}


def _cliente_de_consentimiento(cliente_id: str, correo: str, documento: str = "") -> None:
    container.clients.add(Client(id=cliente_id, email=correo, nombre="Luis Mora", numero_documento=documento))


def test_registro_con_un_documento_ya_registrado_responde_409():
    assert client.post("/identidad/clientes", json=_cuenta("uno@solventa.test", "555001")).status_code == 201

    repetido = client.post("/identidad/clientes", json=_cuenta("dos@solventa.test", "555001"))

    assert repetido.status_code == 409
    assert repetido.json()["detail"] == DUPLICADO_DOCUMENTO
    assert client.post("/identidad/sesiones", json=_cuenta("dos@solventa.test", "555001")).status_code == 401


def test_registro_con_un_documento_ya_registrado_ignora_el_tipo():
    assert client.post("/identidad/clientes", json=_cuenta("tres@solventa.test", "555002")).status_code == 201

    otro_tipo = {**_cuenta("cuatro@solventa.test", "555002"), "tipo_documento": "CE"}

    assert client.post("/identidad/clientes", json=otro_tipo).status_code == 409


def test_registro_vincula_al_cliente_creado_por_consentimiento_con_el_mismo_correo_y_documento():
    _cliente_de_consentimiento("CLI-555003", "luis@solventa.test", "555003")

    alta = client.post("/identidad/clientes", json=_cuenta("luis@solventa.test", "555003"))

    assert alta.status_code == 201
    assert alta.json()["cliente_id"] == "CLI-555003"
    ingreso = client.post("/identidad/sesiones", json=_cuenta("luis@solventa.test", "555003"))
    assert ingreso.json()["cliente_id"] == "CLI-555003"


def test_registro_no_se_apropia_de_un_cliente_de_consentimiento_con_otro_correo():
    _cliente_de_consentimiento("CLI-555004", "asesor@solventa.test", "555004")

    robo = client.post("/identidad/clientes", json=_cuenta("ajena@solventa.test", "555004"))

    assert robo.status_code == 409
    assert robo.json()["detail"] == DUPLICADO_DOCUMENTO


def test_registro_no_se_apropia_de_un_correo_de_consentimiento_con_otro_documento():
    _cliente_de_consentimiento("CLI-555005", "mia@solventa.test", "555005")

    robo = client.post("/identidad/clientes", json=_cuenta("mia@solventa.test", "555999"))

    assert robo.status_code == 409
    assert robo.json()["detail"] == DUPLICADO


def test_registro_completa_el_documento_de_un_cliente_de_consentimiento_que_no_lo_tenia():
    _cliente_de_consentimiento("CLI-SIN-DOC", "sindoc@solventa.test")

    alta = client.post("/identidad/clientes", json=_cuenta("sindoc@solventa.test", "555006"))

    assert alta.status_code == 201
    assert alta.json()["cliente_id"] == "CLI-SIN-DOC"
    assert container.clients.get("CLI-SIN-DOC").numero_documento == "555006"
