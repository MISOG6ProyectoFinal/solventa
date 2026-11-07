"""HU005: el BFF web arma la vista de póliza con asegurado, pagos y siniestros."""

import httpx
from canales.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

POLIZA = {
    "id": "pol-1",
    "numero": "POL-AAA111",
    "estado": "activa",
    "cobro_id": "cobro-1",
    "producto_id": "viaje-internacional",
    "prima": "149940.00",
    "canal": "socios",
    "socio_id": "socio-1",
    "cliente_id": "cli-1",
    "coberturas": [{"id": "medicos", "nombre": "Gastos médicos"}],
    "vigencia": {"desde": "2026-10-10", "hasta": "2026-10-24"},
}
CLIENTE = {
    "id": "cli-1",
    "tipo_documento": "CC",
    "numero_documento": "1020304050",
    "nombre": "María",
    "apellido": "Rodríguez",
    "email": "maria@test.com",
    "telefono": "3001112233",
}


def _no_encontrado() -> httpx.HTTPStatusError:
    request = httpx.Request("GET", "https://interno/x")
    return httpx.HTTPStatusError("404", request=request, response=httpx.Response(404, json={"detail": "x"}, request=request))


class _Servicio:
    """Responde según el prefijo de la ruta; una excepción en el valor se lanza."""

    def __init__(self, rutas: dict) -> None:
        self.rutas = rutas
        self.calls: list[tuple[str, dict]] = []

    def get(self, path: str, **kwargs):
        self.calls.append((path, kwargs))
        for prefijo, respuesta in self.rutas.items():
            if path.startswith(prefijo):
                if isinstance(respuesta, Exception):
                    raise respuesta
                return respuesta
        raise AssertionError(path)


def _parchar(monkeypatch, *, polizas, identidad=None, cotizacion=None, pagos=None, siniestros=None):
    for nombre, servicio in {
        "polizas": polizas,
        "identidad": identidad,
        "cotizacion": cotizacion,
        "pagos": pagos,
        "siniestros": siniestros,
    }.items():
        monkeypatch.setattr(f"canales.web.api.{nombre}", servicio)


def test_buscar_por_identificacion_resuelve_el_cliente_y_enriquece_la_vista(monkeypatch):
    polizas = _Servicio({"/polizas": [POLIZA]})
    identidad = _Servicio({"/identidad/clientes/por-numero/": CLIENTE, "/identidad/clientes/cli-1": CLIENTE})
    cotizacion = _Servicio({"/gobierno-socios/socios/": {"nombre": "Banco Aurora"}})
    _parchar(monkeypatch, polizas=polizas, identidad=identidad, cotizacion=cotizacion)

    respuesta = client.get("/web/polizas", params={"q": "1020304050"})

    assert polizas.calls[0][1]["params"] == {"q": "1020304050", "cliente_id": ["cli-1"]}
    vista = respuesta.json()[0]
    assert vista["number"] == "POL-AAA111"
    assert vista["identification"] == "1020304050"
    assert vista["insuredName"] == "María Rodríguez"
    assert vista["socioOrigen"] == "Banco Aurora"
    assert vista["status"] == "Activa"
    assert vista["premium"] == 149940.0


def test_buscar_por_numero_de_poliza_sin_cliente_ni_socio_usa_valores_por_defecto(monkeypatch):
    sin_cliente = POLIZA | {"cliente_id": None, "socio_id": None}
    polizas = _Servicio({"/polizas": [sin_cliente]})
    identidad = _Servicio({"/identidad/clientes/por-numero/": _no_encontrado()})
    _parchar(monkeypatch, polizas=polizas, identidad=identidad, cotizacion=_Servicio({}))

    vista = client.get("/web/polizas", params={"q": "AAA"}).json()[0]

    assert polizas.calls[0][1]["params"] == {"q": "AAA"}
    assert vista["insuredName"] == "Sin datos del asegurado"
    assert vista["socioOrigen"] == "socios"


def test_listar_sin_texto_no_filtra(monkeypatch):
    polizas = _Servicio({"/polizas": []})
    _parchar(monkeypatch, polizas=polizas)

    assert client.get("/web/polizas").json() == []
    assert polizas.calls[0][1]["params"] == {}


def test_el_detalle_incluye_pagos_y_siniestros_de_la_poliza(monkeypatch):
    avisos = [
        {"id": "a1", "poliza_id": "pol-1", "tipo": "Equipaje", "ocurrido_en": "2026-10-12T10:00:00", "estado": "radicado", "radicado": "SIN-1"},
        {"id": "a2", "poliza_id": "otra", "tipo": "Robo", "ocurrido_en": "2026-10-13T10:00:00", "estado": "borrador"},
    ]
    cobro = {"id": "cobro-1", "creado_en": "2026-10-10T15:00:00+00:00", "monto": "149940.00", "estado": "aprobado"}
    _parchar(
        monkeypatch,
        polizas=_Servicio(
            {
                "/polizas/pol-1/beneficiarios": [{"nombre": "Banco Aurora", "parentesco": "Acreedor", "porcentaje": "80.00"}],
                "/polizas/pol-1": POLIZA,
            }
        ),
        identidad=_Servicio({"/identidad/clientes/": CLIENTE}),
        cotizacion=_Servicio({"/gobierno-socios/socios/": _no_encontrado()}),
        pagos=_Servicio({"/pagos/cobros/": cobro}),
        siniestros=_Servicio({"/siniestros/avisos": avisos}),
    )

    vista = client.get("/web/polizas/pol-1").json()

    assert vista["payments"] == [
        {"ref": "cobro-1", "date": "2026-10-10", "tipo": "Prima", "amount": 149940.0, "status": "Aprobado"}
    ]
    assert vista["claims"] == [{"id": "SIN-1", "tipo": "Equipaje", "fechaOcurrencia": "2026-10-12", "status": "En revisión"}]
    assert vista["coverages"] == [{"name": "Gastos médicos", "included": True}]
    assert vista["beneficiaries"] == [{"name": "Banco Aurora", "parentesco": "Acreedor", "porcentaje": 80.0}]


def test_el_detalle_sin_cobro_ni_cliente_devuelve_listas_vacias(monkeypatch):
    sin_cliente = POLIZA | {"cliente_id": None, "socio_id": None}
    _parchar(
        monkeypatch,
        polizas=_Servicio({"/polizas/pol-1/beneficiarios": [], "/polizas/pol-1": sin_cliente}),
        pagos=_Servicio({"/pagos/cobros/": _no_encontrado()}),
    )

    vista = client.get("/web/polizas/pol-1").json()

    assert vista["payments"] == []
    assert vista["claims"] == []
    assert vista["beneficiaries"] == []


def test_un_error_distinto_de_404_del_servicio_de_clientes_se_propaga(monkeypatch):
    request = httpx.Request("GET", "https://interno/x")
    error = httpx.HTTPStatusError("500", request=request, response=httpx.Response(500, json={"detail": "x"}, request=request))
    _parchar(monkeypatch, polizas=_Servicio({"/polizas": [POLIZA]}), identidad=_Servicio({"/identidad/": error}))

    assert client.get("/web/polizas", params={"q": "AAA"}).status_code == 500
