"""Pruebas del BFF Mobile para catálogo y cotización."""

from unittest.mock import MagicMock, patch

from canales.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

OFERTA = {
    "id": "oferta-1",
    "producto_id": "hogar",
    "prima": "900.00",
    "coberturas": [{"id": "hogar-incendio", "nombre": "Incendio"}],
    "vigencia_propuesta": {"desde": "2026-10-05", "hasta": "2027-10-05"},
    "version_reglas": "2026.10.0",
}

PRODUCTOS = [
    {
        "id": "hogar",
        "nombre": "Seguro Hogar",
        "ramo": {"id": "ramo-hogar", "nombre": "Hogar"},
        "coberturas": [{"id": "hogar-incendio", "nombre": "Incendio"}],
    }
]


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
    body = {"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/movil/cotizaciones", json=body)
    assert response.status_code == 200
    data = response.json()
    assert data["prima"] == "900.00"
    assert data["coberturas"]
    assert data["vigencia_propuesta"]
    assert data["version_reglas"] == "2026.10.0"
    mock_client.post.assert_called_once()
    assert mock_client.post.call_args.args[0] == "/consenso/cotizaciones"
