"""El catálogo dice en qué canales se ofrece cada producto y cuáles exigen consentimiento."""

from cotizacion.catalogo.adapters.repository import PostgresCatalogoRepository
from cotizacion.catalogo.adapters.seed import SEED_PRODUCTOS
from cotizacion.catalogo.domain.models import Canal
from cotizacion.container import container
from cotizacion.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

client = TestClient(app)


def lines_of(canal: str) -> list[dict]:
    response = client.get(f"/catalogo/canales/{canal}/ramos")
    assert response.status_code == 200
    return response.json()


def test_web_ofrece_cuatro_ramos_en_el_orden_del_catalogo():
    assert [line["id"] for line in lines_of("web")] == [
        "ramo-viaje",
        "ramo-microseguro-vida",
        "ramo-parametrico",
        "ramo-vida-hipotecario",
    ]


def test_socios_ofrece_seis_ramos_en_el_orden_del_catalogo():
    assert [line["id"] for line in lines_of("socios")] == [
        "ramo-viaje",
        "ramo-dispositivos",
        "ramo-microseguro-vida",
        "ramo-parametrico",
        "ramo-proteccion-pagos",
        "ramo-vida-hipotecario",
    ]


def test_mobile_solo_ofrece_viaje():
    assert [line["id"] for line in lines_of("mobile")] == ["ramo-viaje"]


def test_solo_vida_hipotecario_exige_consentimiento():
    exigen = {line["id"] for line in lines_of("socios") if line["requiere_consentimiento"]}
    assert exigen == {"ramo-vida-hipotecario"}
    hipotecario = next(line for line in lines_of("web") if line["id"] == "ramo-vida-hipotecario")
    assert hipotecario["productos"] == [
        {"id": "vida-hipotecario", "nombre": "Vida Hipotecario", "requiere_consentimiento": True}
    ]


def test_un_canal_desconocido_se_rechaza():
    assert client.get("/catalogo/canales/telefono/ramos").status_code == 422


def test_un_producto_inactivo_no_se_ofrece():
    original = container.catalogo.productos["parametrico-clima-vuelo"]
    container.catalogo.productos["parametrico-clima-vuelo"] = original.model_copy(update={"activo": False})
    try:
        assert "ramo-parametrico" not in {line["id"] for line in lines_of("web")}
    finally:
        container.catalogo.productos["parametrico-clima-vuelo"] = original


def test_quitar_un_producto_de_un_canal_lo_saca_de_sus_ramos():
    original = container.catalogo.productos["vida-esencial"]
    container.catalogo.productos["vida-esencial"] = original.model_copy(update={"canales": [Canal.SOCIOS]})
    try:
        assert "ramo-microseguro-vida" not in {line["id"] for line in lines_of("web")}
    finally:
        container.catalogo.productos["vida-esencial"] = original


def test_el_contrato_de_un_producto_publica_las_opciones_de_sus_campos():
    response = client.get("/catalogo/productos/viaje-internacional/contrato")

    assert response.status_code == 200
    destino = response.json()["properties"]["destino"]
    assert destino["enum"] == ["Estados Unidos", "España", "México", "Otro país"]


def test_un_producto_sin_tarifa_no_tiene_contrato():
    response = client.get("/catalogo/productos/proteccion-pagos/contrato")

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "producto_sin_contrato"


def legacy_engine():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE ramos (id VARCHAR(64) PRIMARY KEY, nombre VARCHAR(255) NOT NULL)"))
        conn.execute(
            text(
                "CREATE TABLE productos (id VARCHAR(64) PRIMARY KEY, nombre VARCHAR(255) NOT NULL, "
                "ramo_id VARCHAR(64) NOT NULL, activo BOOLEAN NOT NULL, disponible_mobile BOOLEAN NOT NULL)"
            )
        )
        conn.execute(text("INSERT INTO ramos VALUES ('ramo-viaje', 'Viaje')"))
        conn.execute(text("INSERT INTO ramos VALUES ('ramo-nuevo', 'Ramo creado a mano')"))
        conn.execute(text("INSERT INTO productos VALUES ('viaje-internacional', 'Viaje', 'ramo-viaje', 1, 1)"))
        conn.execute(text("INSERT INTO productos VALUES ('producto-nuevo', 'A mano', 'ramo-nuevo', 1, 0)"))
    return engine


def test_un_catalogo_anterior_a_los_canales_toma_los_valores_del_seed():
    repo = PostgresCatalogoRepository(legacy_engine())

    repo.create_schema()
    repo.create_schema()

    viaje = repo.get_producto("viaje-internacional")
    seed = next(p for p in SEED_PRODUCTOS if p.id == "viaje-internacional")
    assert viaje.canales == seed.canales
    assert viaje.presentacion_mobile == seed.presentacion_mobile
    assert repo.get_ramo("ramo-viaje").orden == 4
    assert repo.get_producto("producto-nuevo").canales == []
    assert repo.get_ramo("ramo-nuevo").orden == 0


def test_el_repositorio_guarda_y_lee_los_datos_de_canal():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    repo = PostgresCatalogoRepository(engine)
    repo.create_schema()
    seed = next(p for p in SEED_PRODUCTOS if p.id == "vida-hipotecario")
    from cotizacion.catalogo.adapters.repository import product_values, productos

    with engine.begin() as conn:
        conn.execute(productos.insert().values(**product_values(seed)))

    assert repo.get_producto("vida-hipotecario") == seed
