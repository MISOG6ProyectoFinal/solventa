from unittest.mock import MagicMock, patch

import httpx
from canales.main import app
from fastapi.testclient import TestClient

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


def _status_error(status: int, message: str) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "http://siniestros/siniestros/avisos")
    response = httpx.Response(status, text=message, request=request)
    return httpx.HTTPStatusError(str(status), request=request, response=response)


def test_movil_reenvia_aviso_y_evidencias(monkeypatch):
    upstream = _Upstream(response={"id": "aviso-1", "estado": "borrador"})
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)

    created = client.post("/movil/siniestros", json=AVISO)
    assert created.status_code == 201
    assert created.json() == {"id": "aviso-1", "estado": "borrador"}
    assert upstream.calls[0][0] == "/siniestros/avisos"
    assert upstream.calls[0][1]["json"] == AVISO

    upstream.response = {"evidencia_id": "ev-1", "upload_url": "https://upload.local/x"}
    carga = {"content_type": "image/jpeg", "bytes": 10}
    uploaded = client.post("/movil/siniestros/aviso-1/evidencias/cargas", json=carga)
    assert uploaded.status_code == 201
    assert uploaded.json()["evidencia_id"] == "ev-1"
    assert upstream.calls[1][0] == "/siniestros/avisos/aviso-1/evidencias/cargas"
    assert upstream.calls[1][1]["json"] == carga

    upstream.response = {"id": "ev-1", "estado": "disponible"}
    confirmed = client.post("/movil/siniestros/aviso-1/evidencias/ev-1/confirmar")
    assert confirmed.status_code == 200
    assert confirmed.json()["estado"] == "disponible"
    assert upstream.calls[2][0] == "/siniestros/avisos/aviso-1/evidencias/ev-1/confirmar"

    upstream.response = [{"id": "ev-1"}]
    listed = client.get("/movil/siniestros/aviso-1/evidencias")
    assert listed.status_code == 200
    assert listed.json() == [{"id": "ev-1"}]
    assert upstream.calls[3][0] == "/siniestros/avisos/aviso-1/evidencias"


def test_movil_reenvia_422_y_409(monkeypatch):
    tipo = "Tipo de archivo no permitido. Use JPEG, PNG o MP4."
    upstream = _Upstream(error=_status_error(422, tipo))
    monkeypatch.setattr("canales.movil.api.siniestros", upstream)
    rejected = client.post(
        "/movil/siniestros/aviso-1/evidencias/cargas",
        json={"content_type": "image/gif", "bytes": 10},
    )
    assert rejected.status_code == 422
    assert rejected.json()["detail"] == tipo

    limite = "Este reporte ya tiene 10 evidencias."
    upstream.error = _status_error(409, limite)
    limited = client.post(
        "/movil/siniestros/aviso-1/evidencias/cargas",
        json={"content_type": "image/jpeg", "bytes": 10},
    )
    assert limited.status_code == 409
    assert limited.json()["detail"] == limite


def test_siniestros_no_disponible_responde_503():
    assert client.post("/movil/siniestros", json=AVISO).status_code == 503


@patch("canales.web.api.cotizacion")
def test_bff_web_indica_canal_al_consenso(mock_client: MagicMock):
    mock_client.post.return_value = {"producto_id": "vida-temporal", "prima": "1800.00"}
    response = client.post("/web/cotizaciones", json=SOLICITUD)
    assert response.status_code == 200
    assert mock_client.post.call_args.args[0] == "/consenso/cotizaciones"
    assert mock_client.post.call_args.kwargs["headers"] == {"X-Canal": "web"}
    assert mock_client.post.call_args.kwargs["json"] == SOLICITUD


@patch("canales.socios.api.cotizacion")
def test_bff_socios_indica_canal_al_consenso(mock_client: MagicMock):
    mock_client.post.return_value = {"producto_id": "vida-temporal", "prima": "1800.00"}
    response = client.post("/socios/v1/cotizaciones", json=SOLICITUD, headers={"x-api-key": "test"})
    assert response.status_code == 200
    assert mock_client.post.call_args.args[0] == "/consenso/cotizaciones"
    assert mock_client.post.call_args.kwargs["headers"] == {"X-Canal": "socios"}
    assert mock_client.post.call_args.kwargs["json"] == SOLICITUD
