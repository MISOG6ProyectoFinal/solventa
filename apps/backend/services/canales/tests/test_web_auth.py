"""Autenticación y roles del BFF Web: quién entra al portal y qué puede hacer."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from canales.main import app
from fastapi.testclient import TestClient
from solventa_common.operator_session import ADMIN, ADVISOR, VIEWER

from tests import web_auth
from tests.movil_auth import authorization as customer_authorization

client = TestClient(app)

INVALID_SESSION = {"codigo": "sesion_invalida", "mensaje": "Inicia sesión para continuar."}
PERMISSION_DENIED = {"codigo": "permiso_denegado", "mensaje": "Tu rol no permite esta operación."}
CREDENTIALS = {"correo": "operador@solventa.test", "contrasena": "solventa-local"}
OPERATOR_VIEW = {
    "id": "op-1",
    "correo": "operador@solventa.test",
    "nombre": "Laura Operadora",
    "roles": ["asesor"],
    "activo": True,
    "creado_en": "2026-11-05T10:00:00Z",
}


class _Upstream:
    def __init__(self, response=None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[tuple[str, dict]] = []

    def get(self, path: str, **kwargs):
        self.calls.append((path, kwargs))
        if self.error:
            raise self.error
        return self.response

    post = get
    put = get
    patch = get


def _login_error(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://identidad/identidad/operadores/sesiones")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


@pytest.fixture
def identidad(monkeypatch) -> _Upstream:
    upstream = _Upstream(response={})
    monkeypatch.setattr("canales.web.api.identidad", upstream)
    return upstream


@pytest.fixture
def cotizacion(monkeypatch) -> _Upstream:
    upstream = _Upstream(response={})
    monkeypatch.setattr("canales.web.api.cotizacion", upstream)
    return upstream


def test_login_reenvia_las_credenciales_a_identidad(identidad):
    sesion = {"token": "firmado", "operador": OPERATOR_VIEW}
    identidad.response = sesion

    response = client.post("/web/sesiones", json=CREDENTIALS)

    assert response.status_code == 200
    assert response.json() == sesion
    assert identidad.calls == [("/identidad/operadores/sesiones", {"json": CREDENTIALS})]


def test_login_conserva_el_rechazo_de_credenciales(monkeypatch):
    detalle = {"codigo": "credenciales_invalidas", "mensaje": "Correo o contraseña incorrectos."}
    monkeypatch.setattr("canales.web.api.identidad", _Upstream(error=_login_error(401, detalle)))

    response = client.post("/web/sesiones", json=CREDENTIALS)

    assert response.status_code == 401
    assert response.json()["detail"] == detalle


def test_login_exige_correo_y_contrasena():
    assert client.post("/web/sesiones", json={"correo": "a@b.co"}).status_code == 422


def test_info_del_canal_es_publica():
    assert client.get("/web/").status_code == 200


def test_sesion_devuelve_los_datos_del_token():
    response = client.get("/web/sesion", headers=web_auth.authorization(ADVISOR, VIEWER))

    assert response.status_code == 200
    assert response.json() == {
        "id": "op-1",
        "correo": "operador@solventa.test",
        "nombre": web_auth.OPERATOR_NAME,
        "roles": [ADVISOR, VIEWER],
    }


@pytest.mark.parametrize("role", [ADMIN, ADVISOR, VIEWER])
def test_sesion_la_abre_cualquier_rol(role):
    assert client.get("/web/sesion", headers=web_auth.authorization(role)).status_code == 200


PROTECTED = [
    ("GET", "/web/sesion"),
    ("GET", "/web/ramos"),
    ("POST", "/web/cotizaciones"),
    ("GET", "/web/cotizaciones/COT-1"),
    ("GET", "/web/polizas"),
    ("GET", "/web/polizas/pol-1"),
    ("GET", "/web/socios"),
    ("POST", "/web/socios"),
    ("GET", "/web/socios/s-1"),
    ("GET", "/web/socios/s-1/configuracion"),
    ("PUT", "/web/socios/s-1/configuracion"),
    ("GET", "/web/socios/s-1/consumo"),
    ("PUT", "/web/socios/s-1/cuota"),
    ("POST", "/web/socios/s-1/credencial/rotacion"),
    ("POST", "/web/socios/s-1/credencial/revocacion"),
    ("GET", "/web/socios/s-1/credencial/eventos"),
    ("POST", "/web/consentimientos/solicitar"),
    ("POST", "/web/consentimientos/validar"),
    ("GET", "/web/consentimientos/CNS-1"),
    ("GET", "/web/operadores"),
    ("POST", "/web/operadores"),
    ("PATCH", "/web/operadores/op-1"),
]


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_sin_token_responde_401(method, path):
    response = client.request(method, path, json={})

    assert response.status_code == 401
    assert response.json()["detail"] == INVALID_SESSION


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_el_token_de_un_cliente_movil_no_abre_el_portal(method, path):
    response = client.request(method, path, json={}, headers=customer_authorization())

    assert response.status_code == 401
    assert response.json()["detail"] == INVALID_SESSION


def test_token_vencido_responde_401():
    vencido = web_auth.token(ADMIN, expires_at=datetime.now(UTC) - timedelta(minutes=1))

    response = client.get("/web/ramos", headers={"Authorization": f"Bearer {vencido}"})

    assert response.status_code == 401
    assert response.json()["detail"] == INVALID_SESSION


@pytest.mark.parametrize("header", ["", "Bearer ", "Bearer basura", "Basic abc", "token-sin-esquema"])
def test_encabezado_invalido_responde_401(header):
    response = client.get("/web/ramos", headers={"Authorization": header})

    assert response.status_code == 401
    assert response.json()["detail"] == INVALID_SESSION


READ_ROUTES = [
    ("/web/ramos", "cotizacion", []),
    ("/web/cotizaciones/COT-1", "cotizacion", {}),
    ("/web/socios", "cotizacion", []),
    ("/web/socios/s-1", "cotizacion", {}),
    ("/web/socios/s-1/configuracion", "cotizacion", {}),
    ("/web/socios/s-1/consumo", "cotizacion", {}),
    ("/web/socios/s-1/credencial/eventos", "cotizacion", []),
    ("/web/consentimientos/CNS-1", "identidad", {}),
]


@pytest.mark.parametrize("role", [ADMIN, ADVISOR, VIEWER])
@pytest.mark.parametrize(("path", "service", "body"), READ_ROUTES)
def test_las_consultas_las_abre_cualquier_rol(monkeypatch, role, path, service, body):
    monkeypatch.setattr(f"canales.web.api.{service}", _Upstream(response=body))

    assert client.get(path, headers=web_auth.authorization(role)).status_code == 200


@pytest.mark.parametrize("role", [ADMIN, ADVISOR])
def test_cotizar_y_consentir_lo_hacen_administrador_y_asesor(identidad, cotizacion, role):
    headers = web_auth.authorization(role)

    quote = client.post("/web/cotizaciones", json={"producto_id": "hogar"}, headers=headers)
    request = client.post("/web/consentimientos/solicitar", json={"cliente_id": "CLI-1"}, headers=headers)
    validate = client.post("/web/consentimientos/validar", json={"codigo": "123456"}, headers=headers)

    assert (quote.status_code, request.status_code, validate.status_code) == (200, 201, 200)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/web/cotizaciones"),
        ("POST", "/web/consentimientos/solicitar"),
        ("POST", "/web/consentimientos/validar"),
        ("POST", "/web/socios"),
        ("PUT", "/web/socios/s-1/configuracion"),
        ("PUT", "/web/socios/s-1/cuota"),
        ("POST", "/web/socios/s-1/credencial/rotacion"),
        ("POST", "/web/socios/s-1/credencial/revocacion"),
        ("GET", "/web/operadores"),
        ("POST", "/web/operadores"),
        ("PATCH", "/web/operadores/op-1"),
    ],
)
def test_consulta_no_puede_escribir_ni_administrar(identidad, cotizacion, method, path):
    response = client.request(method, path, json={}, headers=web_auth.viewer())

    assert response.status_code == 403
    assert response.json()["detail"] == PERMISSION_DENIED
    assert identidad.calls == []
    assert cotizacion.calls == []


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/web/socios"),
        ("PUT", "/web/socios/s-1/configuracion"),
        ("GET", "/web/operadores"),
        ("POST", "/web/operadores"),
        ("PATCH", "/web/operadores/op-1"),
    ],
)
def test_asesor_no_puede_administrar(identidad, cotizacion, method, path):
    response = client.request(method, path, json={}, headers=web_auth.advisor())

    assert response.status_code == 403
    assert response.json()["detail"] == PERMISSION_DENIED
    assert identidad.calls == []
    assert cotizacion.calls == []


def test_un_operador_con_varios_roles_usa_el_que_le_alcanza(cotizacion):
    headers = web_auth.authorization(VIEWER, ADMIN)

    assert client.post("/web/socios", json={}, headers=headers).status_code == 201


def test_el_alta_de_socio_registra_al_operador_y_no_lo_que_diga_el_cuerpo(cotizacion):
    cotizacion.response = {"id": "s-1"}

    response = client.post(
        "/web/socios",
        json={"nombre": "Fintech", "autorizado_por": "Otra Persona"},
        headers=web_auth.authorization(ADMIN, name="Mario Admin"),
    )

    assert response.status_code == 201
    assert cotizacion.calls[0][1]["json"] == {"nombre": "Fintech", "autorizado_por": "Mario Admin"}


def test_la_configuracion_de_socio_registra_al_operador_y_no_lo_que_diga_el_cuerpo(cotizacion):
    response = client.put(
        "/web/socios/s-1/configuracion",
        json={"ramos": [], "actualizado_por": "Otra Persona"},
        headers=web_auth.authorization(ADMIN, name="Mario Admin"),
    )

    assert response.status_code == 200
    assert cotizacion.calls[0][1]["json"] == {"ramos": [], "actualizado_por": "Mario Admin"}


def test_la_solicitud_de_consentimiento_registra_al_asesor_del_token(identidad):
    response = client.post(
        "/web/consentimientos/solicitar",
        json={"cliente_id": "CLI-1", "asesor": "Otra Persona"},
        headers=web_auth.authorization(ADVISOR, name="Sara Asesora"),
    )

    assert response.status_code == 201
    assert identidad.calls[0][1]["json"] == {"cliente_id": "CLI-1", "asesor": "Sara Asesora"}


def test_administrador_lista_operadores(identidad):
    identidad.response = [OPERATOR_VIEW]

    response = client.get("/web/operadores", headers=web_auth.admin())

    assert response.status_code == 200
    assert response.json() == [OPERATOR_VIEW]
    assert identidad.calls[0][0] == "/identidad/operadores"


def test_administrador_crea_operadores(identidad):
    identidad.response = OPERATOR_VIEW
    nuevo = {
        "correo": "operador@solventa.test",
        "nombre": "Laura Operadora",
        "roles": ["asesor"],
        "contrasena": "clave-segura",
    }

    response = client.post("/web/operadores", json=nuevo, headers=web_auth.admin())

    assert response.status_code == 201
    assert response.json() == OPERATOR_VIEW
    assert identidad.calls == [("/identidad/operadores", {"json": nuevo})]


def test_administrador_conserva_el_conflicto_al_crear_operadores(monkeypatch):
    detalle = {"codigo": "correo_duplicado", "mensaje": "Ya existe un operador con ese correo."}
    monkeypatch.setattr("canales.web.api.identidad", _Upstream(error=_login_error(409, detalle)))

    response = client.post("/web/operadores", json={}, headers=web_auth.admin())

    assert response.status_code == 409
    assert response.json()["detail"] == detalle


def test_administrador_actualiza_roles_y_estado(identidad):
    identidad.response = {**OPERATOR_VIEW, "roles": ["consulta"], "activo": False}
    cambio = {"roles": ["consulta"], "activo": False}

    response = client.patch("/web/operadores/op-1", json=cambio, headers=web_auth.admin())

    assert response.status_code == 200
    assert response.json()["activo"] is False
    assert identidad.calls == [("/identidad/operadores/op-1", {"json": cambio})]


def test_el_identificador_del_operador_se_codifica_en_la_ruta(identidad):
    identidad.response = OPERATOR_VIEW

    client.patch("/web/operadores/a%3Fb%23c", json={"activo": True}, headers=web_auth.admin())

    assert identidad.calls[0][0] == "/identidad/operadores/a%3Fb%23c"


def test_operador_inexistente_conserva_el_404(monkeypatch):
    detalle = {"codigo": "operador_no_encontrado", "mensaje": "El operador no existe."}
    monkeypatch.setattr("canales.web.api.identidad", _Upstream(error=_login_error(404, detalle)))

    response = client.patch("/web/operadores/no-existe", json={"activo": True}, headers=web_auth.admin())

    assert response.status_code == 404
    assert response.json()["detail"] == detalle


def test_movil_y_socios_no_piden_token_de_operador():
    assert client.get("/movil/").status_code == 200
    assert client.get("/socios/").status_code == 200
    assert client.get("/movil/sesion", headers=web_auth.admin()).status_code == 401
