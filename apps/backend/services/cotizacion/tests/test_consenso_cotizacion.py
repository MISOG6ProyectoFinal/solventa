"""Pruebas de la oferta de cotización vía consenso (persistencia de negocio)."""

from datetime import date, datetime, timedelta

from cotizacion.catalogo.domain.models import Producto
from cotizacion.container import container
from cotizacion.main import app
from fastapi.testclient import TestClient
from solventa_common.vigencia_cotizacion import FIN_DE_DIA, ZONA_COTIZACION, calcular_vigente_hasta

client = TestClient(app)

CANALES = ("mobile", "web", "socios")
PRODUCTO_INACTIVO = "producto-inactivo"

SALIDA = date.today() + timedelta(days=30)
REGRESO = SALIDA + timedelta(days=14)


def post_cotizacion(producto_id: str, canal: str, suma: str = "1000000"):
    return client.post(
        "/consenso/cotizaciones",
        json={"producto_id": producto_id, "suma_asegurada": suma, "edad": 40},
        headers={"X-Canal": canal},
    )


def post_viaje(canal: str = "mobile", **overrides):
    body = {
        "producto_id": "viaje-internacional",
        "destino": "España",
        "fecha_salida": SALIDA.isoformat(),
        "fecha_regreso": REGRESO.isoformat(),
        "viajeros": 1,
    } | overrides
    return client.post("/consenso/cotizaciones", json=body, headers={"X-Canal": canal})


def test_mobile_rechaza_producto_fuera_del_catalogo_mobile():
    response = post_cotizacion("vida-temporal", "mobile")
    assert response.status_code == 422
    assert response.json()["detail"] == "Producto fuera del catálogo móvil: vida-temporal"


def test_mobile_rechaza_hogar_fuera_del_catalogo_mobile():
    response = post_cotizacion("hogar", "mobile")
    assert response.status_code == 422
    assert response.json()["detail"] == "Producto fuera del catálogo móvil: hogar"


def test_mobile_rechaza_productos_del_catalogo_no_disponibles():
    for producto_id in ("proteccion-celular", "vida-esencial"):
        response = post_viaje(producto_id=producto_id)
        assert response.status_code == 422
        assert response.json()["detail"] == f"Producto no disponible para cotización móvil: {producto_id}"


def test_mobile_cotiza_viaje_con_prima_y_vigencia_del_viaje():
    response = post_viaje()
    assert response.status_code == 200
    data = response.json()
    assert data["producto_id"] == "viaje-internacional"
    assert data["prima"] == "149940.00"
    assert data["vigencia_propuesta"] == {"desde": SALIDA.isoformat(), "hasta": REGRESO.isoformat()}
    assert [c["nombre"] for c in data["coberturas"]] == [
        "Gastos médicos en el exterior",
        "Cancelación de viaje",
        "Pérdida de equipaje",
        "Asistencia en viaje",
    ]
    assert data["version_reglas"] == "2026.10.0"
    assert data["id"]


def test_viaje_dos_viajeros_duplica_prima():
    response = post_viaje(viajeros=2)
    assert response.status_code == 200
    assert response.json()["prima"] == "299880.00"


def test_viaje_persiste_una_sola_oferta():
    antes = container.cotizaciones.count()
    response = post_viaje()
    assert response.status_code == 200
    assert container.cotizaciones.count() == antes + 1


def test_viaje_pasa_por_consenso_sin_datos_personales():
    captured: dict = {}
    original = container.cotizar_con_consenso.fanout

    async def fanout(body: dict) -> list[dict]:
        captured["body"] = body
        return await original(body)

    container.cotizar_con_consenso.fanout = fanout
    try:
        response = post_viaje(nombre="María Rodríguez", cedula="1020304050")
    finally:
        container.cotizar_con_consenso.fanout = original

    assert response.status_code == 200
    assert captured["body"] == {
        "producto_id": "viaje-internacional",
        "destino": "España",
        "fecha_salida": SALIDA.isoformat(),
        "fecha_regreso": REGRESO.isoformat(),
        "viajeros": 1,
    }
    assert "nombre" not in captured["body"]
    assert "cedula" not in captured["body"]


def test_consenso_sin_quorum_en_viaje_responde_503():
    async def fanout(body: dict) -> list[dict]:
        return [
            {"prima": "1.00", "version_reglas": "2026.10.0"},
            {"prima": "2.00", "version_reglas": "2026.10.0"},
            {"prima": "3.00", "version_reglas": "2026.10.0"},
        ]

    original = container.cotizar_con_consenso.fanout
    container.cotizar_con_consenso.fanout = fanout
    try:
        response = post_viaje()
    finally:
        container.cotizar_con_consenso.fanout = original

    assert response.status_code == 503


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
    response = post_cotizacion("hogar", "web")
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


def test_la_oferta_incluye_vigente_hasta_al_fin_del_dia():
    antes = datetime.now(ZONA_COTIZACION)
    response = post_viaje()
    despues = datetime.now(ZONA_COTIZACION)

    assert response.status_code == 200
    limite = datetime.fromisoformat(response.json()["vigente_hasta"])
    assert limite.timetz() == FIN_DE_DIA.replace(tzinfo=ZONA_COTIZACION)
    assert limite.date() == calcular_vigente_hasta(antes).date()
    assert antes.date() <= limite.date() <= despues.date()
    assert limite.utcoffset() == ZONA_COTIZACION.utcoffset(None)


def test_cotizacion_se_recupera_por_id():
    creada = post_viaje()
    assert creada.status_code == 200
    cotizacion_id = creada.json()["id"]

    response = client.get(f"/consenso/cotizaciones/{cotizacion_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == cotizacion_id
    assert data["prima"] == creada.json()["prima"]
    assert data["vigente_hasta"] == creada.json()["vigente_hasta"]
    assert data["vigencia_propuesta"] == creada.json()["vigencia_propuesta"]


def test_movil_persiste_el_cliente_sin_enviarlo_al_rating():
    captured: dict = {}

    async def fanout(body: dict) -> list[dict]:
        captured["body"] = body
        payload = {"prima": "149940.00", "version_reglas": "2026.10.0"}
        return [payload, payload, payload]

    original = container.cotizar_con_consenso.fanout
    container.cotizar_con_consenso.fanout = fanout
    try:
        response = client.post(
            "/consenso/cotizaciones",
            json={
                "producto_id": "viaje-internacional",
                "destino": "España",
                "fecha_salida": SALIDA.isoformat(),
                "fecha_regreso": REGRESO.isoformat(),
                "viajeros": 1,
            },
            headers={"X-Canal": "mobile", "X-Cliente-Id": "cliente-1"},
        )
    finally:
        container.cotizar_con_consenso.fanout = original

    assert response.status_code == 200
    assert "cliente_id" not in captured["body"]
    assert "nombre" not in captured["body"]
    guardada = container.cotizaciones.get(response.json()["id"])
    assert guardada is not None
    assert guardada.cliente_id == "cliente-1"
    leida = client.get(f"/consenso/cotizaciones/{response.json()['id']}")
    assert leida.json()["cliente_id"] == "cliente-1"


def test_otro_canal_no_guarda_cliente_id():
    response = client.post(
        "/consenso/cotizaciones",
        json={"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40},
        headers={"X-Canal": "web", "X-Cliente-Id": "cliente-1"},
    )
    assert response.status_code == 200
    assert "cliente_id" not in response.json()
    guardada = container.cotizaciones.get(response.json()["id"])
    assert guardada is not None
    assert guardada.cliente_id is None


def test_cotizacion_inexistente_responde_404():
    response = client.get("/consenso/cotizaciones/no-existe")
    assert response.status_code == 404
    assert response.json()["detail"] == "Cotización no encontrada: no-existe"


def test_calculo_de_rating_no_persiste_cotizacion():
    antes = container.cotizaciones.count()
    body = {"producto_id": "hogar", "suma_asegurada": "1000000", "edad": 40}
    response = client.post("/cotizaciones/calcular", json=body)
    assert response.status_code == 200
    assert "coberturas" not in response.json()
    assert "vigencia_propuesta" not in response.json()
    assert container.cotizaciones.count() == antes
