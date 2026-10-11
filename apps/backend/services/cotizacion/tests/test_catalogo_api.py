"""Pruebas del catálogo Mobile expuesto por el servicio de cotización."""

from cotizacion.catalogo.domain.models import Producto
from cotizacion.container import container
from cotizacion.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def get_productos() -> list[dict]:
    response = client.get("/catalogo/productos")
    assert response.status_code == 200
    return response.json()


def test_catalogo_mobile_devuelve_tres_productos_en_orden():
    ids = [p["id"] for p in get_productos()]
    assert ids == ["viaje-internacional", "proteccion-celular", "vida-esencial"]


def test_disponibilidad_por_producto():
    por_id = {p["id"]: p for p in get_productos()}
    assert por_id["viaje-internacional"]["disponible"] is True
    assert por_id["proteccion-celular"]["disponible"] is False
    assert por_id["vida-esencial"]["disponible"] is False


def test_productos_no_disponibles_siguen_visibles():
    productos = get_productos()
    no_disponibles = [p["id"] for p in productos if not p["disponible"]]
    assert no_disponibles == ["proteccion-celular", "vida-esencial"]


def test_producto_mobile_incluye_datos_de_presentacion():
    por_id = {p["id"]: p for p in get_productos()}
    viaje = por_id["viaje-internacional"]
    assert viaje["nombre"] == "Viaje Internacional"
    assert viaje["descripcion"] == "Gastos médicos, equipaje y asistencia en viaje"
    assert viaje["precio_desde"] == "120000"
    assert viaje["ramo"]["id"] == "ramo-viaje"
    assert [c["nombre"] for c in viaje["coberturas"]] == [
        "Gastos médicos en el exterior",
        "Cancelación de viaje",
        "Pérdida de equipaje",
        "Asistencia en viaje",
    ]
    assert por_id["proteccion-celular"]["descripcion"] == "Daño accidental, robo y líquidos"
    assert por_id["proteccion-celular"]["precio_desde"] == "250000"
    assert por_id["vida-esencial"]["descripcion"] == "Fallecimiento y auxilio funerario"
    assert por_id["vida-esencial"]["precio_desde"] == "96000"


def test_productos_legacy_no_aparecen_en_mobile():
    ids = {p["id"] for p in get_productos()}
    assert ids.isdisjoint({"hogar", "auto", "vida-temporal"})


def test_producto_inactivo_no_aparece():
    original = container.catalogo.productos["viaje-internacional"]
    container.catalogo.productos["viaje-internacional"] = Producto(
        id="viaje-internacional",
        nombre="Viaje Internacional",
        ramo_id="ramo-viaje",
        activo=False,
        disponible_mobile=True,
    )
    try:
        ids = {p["id"] for p in get_productos()}
        assert "viaje-internacional" not in ids
    finally:
        container.catalogo.productos["viaje-internacional"] = original
