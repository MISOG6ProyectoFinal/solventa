"""Pruebas del BFF Mobile para catálogo y cotización de viaje."""

from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from canales.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

SALIDA = date.today()
REGRESO = SALIDA + timedelta(days=14)

OFERTA = {
    "id": "oferta-1",
    "producto_id": "viaje-internacional",
    "prima": "149940.00",
    "coberturas": [
        {"id": "viaje-gastos-medicos", "nombre": "Gastos médicos en el exterior"},
        {"id": "viaje-cancelacion", "nombre": "Cancelación de viaje"},
        {"id": "viaje-equipaje", "nombre": "Pérdida de equipaje"},
        {"id": "viaje-asistencia", "nombre": "Asistencia en viaje"},
    ],
    "vigencia_propuesta": {"desde": SALIDA.isoformat(), "hasta": REGRESO.isoformat()},
    "version_reglas": "2026.10.0",
}

PRODUCTOS = [
    {
        "id": "viaje-internacional",
        "nombre": "Viaje Internacional",
        "descripcion": "Gastos médicos, equipaje y asistencia en viaje",
        "precio_desde": "120000",
        "disponible": True,
        "ramo": {"id": "ramo-viaje", "nombre": "Viaje"},
        "coberturas": [{"id": "viaje-gastos-medicos", "nombre": "Gastos médicos en el exterior"}],
    },
    {
        "id": "proteccion-celular",
        "nombre": "Protección Celular",
        "descripcion": "Daño accidental, robo y líquidos",
        "precio_desde": "250000",
        "disponible": False,
        "ramo": {"id": "ramo-dispositivos", "nombre": "Protección de dispositivos"},
        "coberturas": [],
    },
]


def solicitud_viaje(**overrides) -> dict:
    return {
        "producto_id": "viaje-internacional",
        "nombre": "María Rodríguez",
        "cedula": "1020304050",
        "destino": "España",
        "fecha_salida": SALIDA.isoformat(),
        "fecha_regreso": REGRESO.isoformat(),
        "viajeros": 1,
    } | overrides


@patch("canales.movil.api.cotizacion")
def test_bff_movil_lista_productos_via_servicio_cotizacion(mock_client: MagicMock):
    mock_client.get.return_value = PRODUCTOS
    response = client.get("/movil/productos")
    assert response.status_code == 200
    assert response.json() == PRODUCTOS
    mock_client.get.assert_called_once_with("/catalogo/productos")


@patch("canales.movil.api.cotizacion")
def test_bff_movil_devuelve_oferta_completa(mock_client: MagicMock):
    mock_client.post.return_value = OFERTA
    response = client.post("/movil/cotizaciones", json=solicitud_viaje())
    assert response.status_code == 200
    data = response.json()
    assert data["prima"] == "149940.00"
    assert len(data["coberturas"]) == 4
    assert data["vigencia_propuesta"]
    assert data["version_reglas"] == "2026.10.0"
    mock_client.post.assert_called_once()
    assert mock_client.post.call_args.args[0] == "/consenso/cotizaciones"
    assert mock_client.post.call_args.kwargs["headers"] == {"X-Canal": "mobile"}


@patch("canales.movil.api.cotizacion")
def test_bff_movil_no_propaga_pii_a_cotizacion(mock_client: MagicMock):
    mock_client.post.return_value = OFERTA
    response = client.post("/movil/cotizaciones", json=solicitud_viaje())
    assert response.status_code == 200
    enviado = mock_client.post.call_args.kwargs["json"]
    assert enviado == {
        "producto_id": "viaje-internacional",
        "destino": "España",
        "fecha_salida": SALIDA.isoformat(),
        "fecha_regreso": REGRESO.isoformat(),
        "viajeros": 1,
    }
    assert "nombre" not in enviado
    assert "cedula" not in enviado


@patch("canales.movil.api.cotizacion")
def test_bff_movil_valida_el_formulario_antes_de_delegar(mock_client: MagicMock):
    invalidas = (
        solicitud_viaje(nombre=""),
        solicitud_viaje(nombre="   "),
        solicitud_viaje(cedula=""),
        solicitud_viaje(cedula="10A0304050"),
        solicitud_viaje(destino="Francia"),
        solicitud_viaje(fecha_salida=(SALIDA - timedelta(days=1)).isoformat()),
        solicitud_viaje(fecha_regreso=SALIDA.isoformat()),
        solicitud_viaje(fecha_regreso=(SALIDA - timedelta(days=1)).isoformat()),
        solicitud_viaje(viajeros=0),
        solicitud_viaje(viajeros=-2),
    )
    for body in invalidas:
        response = client.post("/movil/cotizaciones", json=body)
        assert response.status_code == 422, body
    mock_client.post.assert_not_called()


@patch("canales.movil.api.cotizacion")
def test_bff_movil_exige_todos_los_campos(mock_client: MagicMock):
    completa = solicitud_viaje()
    for campo in completa:
        body = {k: v for k, v in completa.items() if k != campo}
        response = client.post("/movil/cotizaciones", json=body)
        assert response.status_code == 422, campo
    mock_client.post.assert_not_called()
