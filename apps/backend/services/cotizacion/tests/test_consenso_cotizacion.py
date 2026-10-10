"""Pruebas de la oferta de cotización vía consenso (persistencia de negocio)."""

from cotizacion.catalogo.domain.models import Producto
from cotizacion.container import container
from cotizacion.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

CANALES = ("mobile", "web", "socios")
PRODUCTO_INACTIVO = "producto-inactivo"


def post_cotizacion(producto_id: str, canal: str, suma: str = "1000000"):
    return client.post(
        "/consenso/cotizaciones",
        json={"producto_id": producto_id, "suma_asegurada": suma, "edad": 40},
        headers={"X-Canal": canal},
    )


def test_mobile_rechaza_producto_no_disponible_mobile():
    response = post_cotizacion("vida-temporal", "mobile")
    assert response.status_code == 422
    assert response.json()["detail"] == "Producto no disponible para cotización móvil: vida-temporal"


def test_web_permite_producto_activo_no_disponible_mobile():
    response = post_cotizacion("vida-temporal", "web")
    assert response.status_code == 200
    data = response.json()
    assert data["producto_id"] == "vida-temporal"
    assert "prima" in data


def test_socios_permite_producto_activo_no_disponible_mobile():
    response = post_cotizacion("vida-temporal", "socios")
    assert response.status_code == 200
    data = response.json()
    assert data["producto_id"] == "vida-temporal"
    assert "prima" in data


def test_todos_los_canales_rechazan_producto_inactivo():
    container.catalogo.productos[PRODUCTO_INACTIVO] = Producto(
        id=PRODUCTO_INACTIVO,
        nombre="Producto inactivo",
        ramo_id="ramo-hogar",
        activo=False,
        disponible_mobile=True,
    )
    try:
        for canal in CANALES:
            response = post_cotizacion(PRODUCTO_INACTIVO, canal)
            assert response.status_code == 422
            detail = response.json()["detail"]
            assert detail == f"Producto inactivo: {PRODUCTO_INACTIVO}"
            assert "móvil" not in detail
    finally:
        container.catalogo.productos.pop(PRODUCTO_INACTIVO, None)


def test_todos_los_canales_rechazan_producto_inexistente():
    for canal in CANALES:
        response = post_cotizacion("no-existe", canal)
        assert response.status_code == 404
        assert response.json()["detail"] == "Producto no encontrado: no-existe"


def test_consenso_exige_canal():
    body = {"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/consenso/cotizaciones", json=body)
    assert response.status_code == 422


def test_el_canal_no_se_envia_al_calculo_de_rating():
    captured: dict = {}

    async def fanout(body: dict) -> list[dict]:
        captured["body"] = body
        payload = {"prima": "900.00", "version_reglas": "2026.10.0"}
        return [payload, payload, payload]

    original = container.cotizar_con_consenso.fanout
    container.cotizar_con_consenso.fanout = fanout
    try:
        response = post_cotizacion("hogar", "web")
    finally:
        container.cotizar_con_consenso.fanout = original

    assert response.status_code == 200
    assert captured["body"]["producto_id"] == "hogar"
    assert "canal" not in captured["body"]
    assert "X-Canal" not in captured["body"]


def test_cotizacion_devuelve_prima_coberturas_y_vigencia():
    response = post_cotizacion("hogar", "mobile")
    assert response.status_code == 200
    data = response.json()
    assert data["producto_id"] == "hogar"
    assert data["prima"] == "900.00"
    assert data["version_reglas"] == "2026.10.0"
    assert len(data["coberturas"]) >= 2
    assert "desde" in data["vigencia_propuesta"]
    assert "hasta" in data["vigencia_propuesta"]
    assert data["vigencia_propuesta"]["hasta"] > data["vigencia_propuesta"]["desde"]


def test_consenso_persiste_una_sola_cotizacion():
    antes = container.cotizaciones.count()
    response = post_cotizacion("hogar", "web")
    assert response.status_code == 200
    assert container.cotizaciones.count() == antes + 1


def test_calculo_de_rating_no_persiste_cotizacion():
    antes = container.cotizaciones.count()
    body = {"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/cotizaciones/calcular", json=body)
    assert response.status_code == 200
    assert "coberturas" not in response.json()
    assert "vigencia_propuesta" not in response.json()
    assert container.cotizaciones.count() == antes
