from datetime import UTC, date, datetime, timedelta

import httpx
import pytest
from canales.config import settings
from canales.main import app
from fastapi.testclient import TestClient
from solventa_common.sesion import sign_token

client = TestClient(app)

CUERPO = {"correo": "cliente@solventa.test", "contrasena": "solventa-local"}
REGISTRO = {**CUERPO, "nombre": "Ana", "apellido": "Rojas"}
SESION = {"token": "token-firmado", "cliente_id": "cliente-demo"}


class _Upstream:
    def __init__(self, response=None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[tuple[str, dict]] = []

    def post(self, path: str, **kwargs):
        self.calls.append((path, kwargs))
        if self.error:
            raise self.error
        return self.response


def _error_json(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "http://identidad/identidad/sesiones")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


def _token(*, expires_at: datetime, client_id: str = "cliente-demo") -> str:
    return sign_token(
        client_id,
        CUERPO["correo"],
        settings.sesion_secreto,
        first_name="Ana",
        last_name="Rojas",
        expires_at=expires_at,
    )


def test_movil_reenvia_el_inicio_de_sesion(monkeypatch):
    upstream = _Upstream(response=SESION)
    monkeypatch.setattr("canales.movil.api.identidad", upstream)

    response = client.post("/movil/sesiones", json=CUERPO)

    assert response.status_code == 200
    assert response.json() == SESION
    assert upstream.calls == [("/identidad/sesiones", {"json": CUERPO})]


def test_movil_conserva_el_rechazo_de_credenciales(monkeypatch):
    detalle = "Correo o contraseña incorrectos"
    monkeypatch.setattr("canales.movil.api.identidad", _Upstream(error=_error_json(401, detalle)))

    response = client.post("/movil/sesiones", json=CUERPO)

    assert response.status_code == 401
    assert response.json()["detail"] == detalle


def test_movil_reenvia_el_registro(monkeypatch):
    upstream = _Upstream(response=SESION)
    monkeypatch.setattr("canales.movil.api.identidad", upstream)

    response = client.post("/movil/registros", json=REGISTRO)

    assert response.status_code == 201
    assert response.json() == SESION
    assert upstream.calls == [("/identidad/clientes", {"json": REGISTRO})]


def test_movil_conserva_el_correo_duplicado(monkeypatch):
    detalle = "Ya existe una cuenta con este correo."
    monkeypatch.setattr("canales.movil.api.identidad", _Upstream(error=_error_json(409, detalle)))

    response = client.post("/movil/registros", json=REGISTRO)

    assert response.status_code == 409
    assert response.json()["detail"] == detalle


def _rutas_protegidas() -> list[tuple[str, str, dict | None]]:
    salida = date.today()
    return [
        ("GET", "/movil/productos", None),
        (
            "POST",
            "/movil/cotizaciones",
            {
                "producto_id": "viaje-internacional",
                "nombre": "Ana",
                "cedula": "1020304050",
                "destino": "España",
                "fecha_salida": salida.isoformat(),
                "fecha_regreso": (salida + timedelta(days=1)).isoformat(),
                "viajeros": 1,
            },
        ),
        ("GET", "/movil/siniestros", None),
        ("POST", "/movil/siniestros", {"poliza_id": "POL-1"}),
        ("POST", "/movil/siniestros/aviso-1/evidencias/cargas", {"content_type": "image/jpeg"}),
        ("POST", "/movil/siniestros/aviso-1/evidencias/ev-1/confirmar", None),
        ("GET", "/movil/siniestros/aviso-1/evidencias", None),
    ]


@pytest.mark.parametrize(("method", "path", "body"), _rutas_protegidas())
def test_movil_exige_sesion(method: str, path: str, body: dict | None):
    response = client.request(method, path, json=body)

    assert response.status_code == 401
    assert response.json()["detail"] == "La sesión no es válida"


def test_movil_producto_con_token_invalido_responde_401():
    response = client.get("/movil/productos", headers={"Authorization": "Bearer no-es-un-token"})

    assert response.status_code == 401
    assert response.json()["detail"] == "La sesión no es válida"


def test_movil_sesion_sin_token_responde_401():
    assert client.get("/movil/sesion").status_code == 401
    assert client.get("/movil/sesion").json()["detail"] == "La sesión no es válida"


def test_movil_sesion_con_token_invalido_responde_401():
    response = client.get("/movil/sesion", headers={"Authorization": "Bearer no-es-un-token"})

    assert response.status_code == 401
    assert response.json()["detail"] == "La sesión no es válida"


def test_movil_sesion_vencida_responde_401():
    token = _token(expires_at=datetime.now(UTC) - timedelta(seconds=1))

    response = client.get("/movil/sesion", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "La sesión no es válida"


def test_movil_sesion_vigente_devuelve_el_cliente_sin_consultar_identidad(monkeypatch):
    def boom(*_args, **_kwargs):
        raise AssertionError("la sesión se comprueba en el BFF")

    upstream = _Upstream()
    upstream.post = boom
    upstream.get = boom
    monkeypatch.setattr("canales.movil.api.identidad", upstream)
    token = _token(expires_at=datetime.now(UTC) + timedelta(days=7))

    response = client.get("/movil/sesion", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "cliente_id": "cliente-demo",
        "correo": "cliente@solventa.test",
        "nombre": "Ana",
        "apellido": "Rojas",
    }
