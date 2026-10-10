"""Pruebas del catálogo expuesto por el servicio de cotización."""

from cotizacion.catalogo.domain.models import Producto
from cotizacion.container import container
from cotizacion.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_lista_solo_productos_habilitados_para_mobile():
    response = client.get("/catalogo/productos")
    assert response.status_code == 200
    ids = {p["id"] for p in response.json()}
    assert "hogar" in ids
    assert "auto" in ids
    assert "vida-temporal" not in ids


def test_no_lista_producto_deshabilitado_para_mobile():
    response = client.get("/catalogo/productos")
    assert response.status_code == 200
    assert all(p["id"] != "vida-temporal" for p in response.json())


def test_producto_mobile_incluye_ramo_y_coberturas():
    response = client.get("/catalogo/productos")
    hogar = next(p for p in response.json() if p["id"] == "hogar")
    assert hogar["nombre"] == "Seguro Hogar"
    assert hogar["ramo"]["id"] == "ramo-hogar"
    assert {c["id"] for c in hogar["coberturas"]} >= {"hogar-incendio", "hogar-robo"}


def test_no_lista_producto_inactivo():
    container.catalogo.productos["auto"] = Producto(
        id="auto",
        nombre="Seguro Auto",
        ramo_id="ramo-auto",
        activo=False,
        disponible_mobile=True,
    )
    try:
        ids = {p["id"] for p in client.get("/catalogo/productos").json()}
        assert "auto" not in ids
    finally:
        container.catalogo.productos["auto"] = Producto(
            id="auto",
            nombre="Seguro Auto",
            ramo_id="ramo-auto",
            activo=True,
            disponible_mobile=True,
        )
