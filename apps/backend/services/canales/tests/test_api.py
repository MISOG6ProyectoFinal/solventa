from unittest.mock import MagicMock, patch

import httpx
from canales.main import app
from fastapi.testclient import TestClient

from tests.movil_auth import authorization

client = TestClient(app)

AVISO = {
    "poliza_id": "POL-1",
    "tipo": "choque",
    "ocurrido_en": "2026-10-01T00:00:00Z",
    "descripcion": "Golpe en la puerta",
}

SOLICITUD = {"producto_id": "vida-temporal", "suma_asegurada": "1000000", "edad": 40}


def test_live():
    assert client.get("/health/live").json()["service"] == "canales"


def test_modulos_montados():
    assert client.get("/web/").status_code == 200
    assert client.get("/movil/").status_code == 200
    assert client.get("/socios/").status_code == 200


def test_socios_exige_api_key():
    assert client.post("/socios/v1/cotizaciones", json={}).status_code == 422


def test_servicio_interno_caido_responde_503():
    assert client.post("/web/cotizaciones", json={"producto_id": "hogar"}).status_code == 503


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

    get = post
    put = post


def _status_error(status: int, message: str) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://siniestros/siniestros/avisos")
    response = httpx.Response(status, text=message, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


def test_movil_lista_los_avisos_del_cliente_de_la_sesion(monkeypatch):
    avisos = [{"id": "aviso-1", "estado": "borrador", "cliente_id": "cliente-demo"}]
    upstream = _Upstream(response=avisos)
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)

    response = client.get("/movil/siniestros", headers=authorization())

    assert response.status_code == 200
    assert response.json() == avisos
    assert upstream.calls[0][0] == "/siniestros/avisos"
    assert upstream.calls[0][1]["headers"] == {"X-Cliente-Id": "cliente-demo"}


def test_movil_radica_el_aviso_del_cliente(monkeypatch):
    upstream = _Upstream(response={"id": "aviso-1", "estado": "radicado"})
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)

    response = client.post("/movil/siniestros/aviso-1/radicar", headers=authorization())

    assert response.status_code == 200
    assert response.json()["estado"] == "radicado"
    assert upstream.calls[0][0] == "/siniestros/avisos/aviso-1/radicar"
    assert upstream.calls[0][1]["headers"] == {"X-Cliente-Id": "cliente-demo"}


def test_movil_asocia_el_aviso_con_el_cliente_de_la_sesion(monkeypatch):
    upstream = _Upstream(response={"id": "aviso-1", "estado": "borrador"})
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)

    response = client.post(
        "/movil/siniestros",
        json={**AVISO, "cliente_id": "otro-cliente"},
        headers=authorization(),
    )

    assert response.status_code == 201
    assert upstream.calls[0][1]["json"] == {**AVISO, "cliente_id": "cliente-demo"}


def test_movil_reenvia_aviso_y_evidencias(monkeypatch):
    upstream = _Upstream(response={"id": "aviso-1", "estado": "borrador"})
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)

    headers = authorization()
    created = client.post("/movil/siniestros", json=AVISO, headers=headers)
    assert created.status_code == 201
    assert created.json() == {"id": "aviso-1", "estado": "borrador"}
    assert upstream.calls[0][0] == "/siniestros/avisos"
    assert upstream.calls[0][1]["json"] == {**AVISO, "cliente_id": "cliente-demo"}

    upstream.response = {"evidencia_id": "ev-1", "upload_url": "https://upload.local/x"}
    carga = {"content_type": "image/jpeg", "bytes": 10}
    uploaded = client.post("/movil/siniestros/aviso-1/evidencias/cargas", json=carga, headers=headers)
    assert uploaded.status_code == 201
    assert uploaded.json()["evidencia_id"] == "ev-1"
    assert upstream.calls[1][0] == "/siniestros/avisos/aviso-1/evidencias/cargas"
    assert upstream.calls[1][1]["json"] == carga
    assert upstream.calls[1][1]["headers"] == {"X-Cliente-Id": "cliente-demo"}

    upstream.response = {"id": "ev-1", "estado": "disponible"}
    confirmed = client.post("/movil/siniestros/aviso-1/evidencias/ev-1/confirmar", headers=headers)
    assert confirmed.status_code == 200
    assert confirmed.json()["estado"] == "disponible"
    assert upstream.calls[2][0] == "/siniestros/avisos/aviso-1/evidencias/ev-1/confirmar"
    assert upstream.calls[2][1]["headers"] == {"X-Cliente-Id": "cliente-demo"}

    upstream.response = [{"id": "ev-1"}]
    listed = client.get("/movil/siniestros/aviso-1/evidencias", headers=headers)
    assert listed.status_code == 200
    assert listed.json() == [{"id": "ev-1"}]
    assert upstream.calls[3][0] == "/siniestros/avisos/aviso-1/evidencias"
    assert upstream.calls[3][1]["headers"] == {"X-Cliente-Id": "cliente-demo"}


def test_movil_reenvia_422_y_409(monkeypatch):
    tipo = "Tipo de archivo no permitido. Use JPEG, PNG o MP4."
    upstream = _Upstream(error=_status_error(422, tipo))
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)
    headers = authorization()
    rejected = client.post(
        "/movil/siniestros/aviso-1/evidencias/cargas",
        json={"content_type": "image/gif", "bytes": 10},
        headers=headers,
    )
    assert rejected.status_code == 422
    assert rejected.json()["detail"] == tipo

    limite = "Este reporte ya tiene 10 evidencias."
    upstream.error = _status_error(409, limite)
    limited = client.post(
        "/movil/siniestros/aviso-1/evidencias/cargas",
        json={"content_type": "image/jpeg", "bytes": 10},
        headers=headers,
    )
    assert limited.status_code == 409
    assert limited.json()["detail"] == limite


def test_siniestros_no_disponible_responde_503():
    assert client.post("/movil/siniestros", json=AVISO, headers=authorization()).status_code == 503


@patch("canales.web.api.cotizacion")
def test_bff_web_indica_canal_al_consenso(mock_client: MagicMock):
    mock_client.post.return_value = {"producto_id": "vida-temporal", "prima": "1800.00"}
    response = client.post("/web/cotizaciones", json=SOLICITUD)
    assert response.status_code == 200
    assert mock_client.post.call_args.args[0] == "/consenso/cotizaciones"
    assert mock_client.post.call_args.kwargs["headers"] == {"X-Canal": "web"}
    assert mock_client.post.call_args.kwargs["json"] == SOLICITUD


CREDENCIALES = {"X-Client-Id": "sv_live_demo_ab12", "X-Api-Key": "sv_sec_demo"}


@patch("canales.socios.api.cotizacion")
def test_bff_socios_envia_las_credenciales_a_gobierno_de_api(mock_client: MagicMock):
    mock_client.post.return_value = {"producto_id": "vida-temporal", "prima": "1800.00"}
    response = client.post("/socios/v1/cotizaciones", json=SOLICITUD, headers=CREDENCIALES)
    assert response.status_code == 200
    assert mock_client.post.call_args.args[0] == "/gobierno-socios/cotizaciones"
    assert mock_client.post.call_args.kwargs["headers"] == CREDENCIALES
    assert mock_client.post.call_args.kwargs["json"] == SOLICITUD


@patch("canales.socios.api.cotizacion")
def test_partner_bff_lists_products_with_credentials(mock_client: MagicMock):
    mock_client.get.return_value = [{"producto_id": "viaje-internacional"}]

    response = client.get("/socios/v1/productos", headers=CREDENCIALES)

    assert response.status_code == 200
    assert response.json() == [{"producto_id": "viaje-internacional"}]
    assert mock_client.get.call_args.args[0] == "/gobierno-socios/catalogo"
    assert mock_client.get.call_args.kwargs["headers"] == CREDENCIALES


def test_partner_bff_requires_credentials_to_list_products():
    assert client.get("/socios/v1/productos").status_code == 422


def test_bff_socios_exige_client_id_y_secreto():
    solo_secreto = {"X-Api-Key": CREDENCIALES["X-Api-Key"]}
    assert client.post("/socios/v1/cotizaciones", json=SOLICITUD, headers=solo_secreto).status_code == 422


def _error_json(status: int, detail) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://cotizacion/gobierno-socios")
    response = httpx.Response(status, json={"detail": detail}, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


def test_bff_socios_conserva_el_rechazo_de_credenciales(monkeypatch):
    detalle = {"codigo": "credencial_invalida", "mensaje": "Las credenciales del socio no son válidas."}
    monkeypatch.setattr("canales.socios.api.cotizacion", _Upstream(error=_error_json(401, detalle)))

    response = client.post("/socios/v1/cotizaciones", json=SOLICITUD, headers=CREDENCIALES)

    assert response.status_code == 401
    assert response.json()["detail"] == detalle


ALTA_SOCIO = {
    "nombre": "Fintech Demo",
    "identificador": "FINTECH-DEMO",
    "tipo": "Fintech",
    "pais": "Colombia",
    "correo_contacto": "ops@fintech.demo",
    "alcances": ["cotizacion"],
    "autorizado_por": "Ana Gómez",
}


def test_bff_web_da_de_alta_y_consulta_socios(monkeypatch):
    creado = {"id": "s-1", "client_id": "sv_live_fintechdemo_ab12", "secreto": "sv_sec_x"}
    upstream = _Upstream(response=creado)
    monkeypatch.setattr("canales.web.api.cotizacion", upstream)

    alta = client.post("/web/socios", json=ALTA_SOCIO)
    assert alta.status_code == 201
    assert alta.json() == creado
    assert upstream.calls[0] == ("/gobierno-socios/socios", {"json": ALTA_SOCIO})

    upstream.response = [{"id": "s-1"}]
    assert client.get("/web/socios").json() == [{"id": "s-1"}]
    assert upstream.calls[1][0] == "/gobierno-socios/socios"

    upstream.response = {"id": "s-1"}
    assert client.get("/web/socios/s-1").json() == {"id": "s-1"}
    assert upstream.calls[2][0] == "/gobierno-socios/socios/s-1"


def test_bff_web_conserva_el_motivo_del_identificador_duplicado(monkeypatch):
    detalle = {
        "codigo": "identificador_duplicado",
        "mensaje": "Ya existe un socio con este identificador. No es posible crearlo de nuevo.",
    }
    monkeypatch.setattr("canales.web.api.cotizacion", _Upstream(error=_error_json(409, detalle)))

    response = client.post("/web/socios", json=ALTA_SOCIO)

    assert response.status_code == 409
    assert response.json()["detail"] == detalle


def test_bff_web_consulta_y_actualiza_la_configuracion_del_socio(monkeypatch):
    vigente = {"socio_id": "s-1", "ramos": [{"id": "ramo-viaje", "habilitado": True, "coberturas": []}]}
    upstream = _Upstream(response=vigente)
    monkeypatch.setattr("canales.web.api.cotizacion", upstream)
    cambio = {"ramos": [{"ramo_id": "ramo-viaje", "coberturas": []}], "actualizado_por": "Ana Gómez"}

    assert client.get("/web/socios/s-1/configuracion").json() == vigente
    assert client.put("/web/socios/s-1/configuracion", json=cambio).json() == vigente

    assert upstream.calls[0][0] == "/gobierno-socios/socios/s-1/configuracion"
    assert upstream.calls[1] == ("/gobierno-socios/socios/s-1/configuracion", {"json": cambio})


def test_bff_socios_conserva_el_error_de_alcance_por_ramo(monkeypatch):
    detalle = {"codigo": "ramo_no_habilitado", "mensaje": "El ramo 'Viaje' no está habilitado para este socio."}
    monkeypatch.setattr("canales.socios.api.cotizacion", _Upstream(error=_error_json(403, detalle)))

    response = client.post("/socios/v1/cotizaciones", json=SOLICITUD, headers=CREDENCIALES)

    assert response.status_code == 403
    assert response.json()["detail"] == detalle


ASISTENCIA = {"servicio": "grua", "ubicacion": "Calle 85 #12-34, Bogotá", "gps": "GPS 4.6683, -74.0531 (±8 m)"}


def test_movil_solicita_asistencia_con_el_cliente_de_la_sesion(monkeypatch):
    creada = {"id": "as-1", "numero": "AST-1111", "servicio": "grua"}
    upstream = _Upstream(response=creada)
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)

    response = client.post("/movil/siniestros/aviso-1/asistencias", json=ASISTENCIA, headers=authorization())

    assert response.status_code == 201
    assert response.json() == creada
    assert upstream.calls[0][0] == "/siniestros/avisos/aviso-1/asistencias"
    assert upstream.calls[0][1]["json"] == ASISTENCIA
    assert upstream.calls[0][1]["headers"] == {"X-Cliente-Id": "cliente-demo"}


def test_movil_lista_la_asistencia_del_aviso(monkeypatch):
    upstream = _Upstream(response=[{"id": "as-1"}])
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)

    response = client.get("/movil/siniestros/aviso-1/asistencias", headers=authorization())

    assert response.status_code == 200
    assert response.json() == [{"id": "as-1"}]
    assert upstream.calls[0][0] == "/siniestros/avisos/aviso-1/asistencias"
    assert upstream.calls[0][1]["headers"] == {"X-Cliente-Id": "cliente-demo"}


def test_movil_reenvia_409_de_asistencia(monkeypatch):
    duplicada = "Ya solicitaste asistencia para este siniestro."
    monkeypatch.setattr("canales.movil.api.siniestros", _Upstream(error=_status_error(409, duplicada)))

    response = client.post("/movil/siniestros/aviso-1/asistencias", json=ASISTENCIA, headers=authorization())

    assert response.status_code == 409
    assert response.json()["detail"] == duplicada


def test_movil_asistencia_exige_sesion():
    assert client.post("/movil/siniestros/aviso-1/asistencias", json=ASISTENCIA).status_code == 401
    assert client.get("/movil/siniestros/aviso-1/asistencias").status_code == 401


def test_movil_reenvia_la_consulta_de_prestadores_cercanos(monkeypatch):
    collection = {"type": "FeatureCollection", "features": []}
    upstream = _Upstream(response=collection)
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)

    response = client.get(
        "/movil/prestadores/cercanos?lat=4.711&lon=-74.0721&radio_km=5&servicio=grua", headers=authorization()
    )

    assert response.status_code == 200
    assert response.json() == collection
    assert upstream.calls[0][0] == "/siniestros/prestadores/cercanos"
    assert upstream.calls[0][1]["params"] == {"lat": "4.711", "lon": "-74.0721", "radio_km": "5", "servicio": "grua"}
    assert "headers" not in upstream.calls[0][1]


def test_movil_reenvia_422_de_prestadores_cercanos(monkeypatch):
    monkeypatch.setattr("canales.movil.api.siniestros", _Upstream(error=_status_error(422, "radio_km fuera de rango")))

    response = client.get("/movil/prestadores/cercanos?lat=4.7&lon=-74&radio_km=99", headers=authorization())

    assert response.status_code == 422


def test_movil_prestadores_cercanos_exige_sesion():
    assert client.get("/movil/prestadores/cercanos?lat=4.7&lon=-74").status_code == 401
