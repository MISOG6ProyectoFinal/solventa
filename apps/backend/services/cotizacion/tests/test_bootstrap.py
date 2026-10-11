"""El bootstrap inicializa la BD una vez. El arranque de las réplicas solo se conecta."""

from unittest.mock import MagicMock, patch

import pytest
from cotizacion.bootstrap import bootstrap, inicializar_almacen, main
from cotizacion.catalogo.adapters.repository import InMemoryCatalogoRepository
from cotizacion.consenso.adapters.cotizacion_repository import InMemoryCotizacionRepository
from cotizacion.container import Container


class _Catalogo(InMemoryCatalogoRepository):
    def __init__(self) -> None:
        super().__init__()
        self.esquemas = 0

    def create_schema(self) -> None:
        self.esquemas += 1


class _Cotizaciones(InMemoryCotizacionRepository):
    def __init__(self) -> None:
        super().__init__()
        self.esquemas = 0

    def create_schema(self) -> None:
        self.esquemas += 1


def test_use_postgres_no_ejecuta_seed_ni_crea_schema():
    engine = MagicMock()
    with (
        patch("cotizacion.container.PostgresCatalogoRepository") as catalogo_cls,
        patch("cotizacion.container.PostgresCotizacionRepository") as cotizaciones_cls,
        patch("cotizacion.container.seed_catalogo") as seed,
    ):
        contenedor = Container()
        seed.reset_mock()
        contenedor.use_postgres(engine)

    seed.assert_not_called()
    catalogo_cls.return_value.create_schema.assert_not_called()
    cotizaciones_cls.return_value.create_schema.assert_not_called()
    catalogo_cls.assert_called_once_with(engine)
    cotizaciones_cls.assert_called_once_with(engine)
    assert contenedor.catalogo is catalogo_cls.return_value
    assert contenedor.cotizaciones is cotizaciones_cls.return_value


PRODUCTOS_SEED = {
    "hogar",
    "auto",
    "vida-temporal",
    "viaje-internacional",
    "proteccion-celular",
    "vida-esencial",
}


def test_bootstrap_crea_schema_e_inserta_dataset_inicial():
    catalogo = _Catalogo()
    cotizaciones = _Cotizaciones()
    inicializar_almacen(catalogo, cotizaciones)
    assert catalogo.esquemas == 1
    assert cotizaciones.esquemas == 1
    assert {p.id for p in catalogo.list_productos()} == PRODUCTOS_SEED
    assert {c.id for c in catalogo.list_coberturas()} >= {
        "hogar-incendio",
        "auto-rc",
        "vida-fallecimiento",
        "viaje-gastos-medicos",
        "celular-robo",
        "vida-esencial-auxilio",
    }


def test_dataset_inicial_marca_disponibilidad_mobile():
    catalogo = _Catalogo()
    cotizaciones = _Cotizaciones()
    inicializar_almacen(catalogo, cotizaciones)
    disponibilidad = {p.id: p.disponible_mobile for p in catalogo.list_productos()}
    assert disponibilidad["viaje-internacional"] is True
    assert disponibilidad["proteccion-celular"] is False
    assert disponibilidad["vida-esencial"] is False


def test_startup_no_reinserta_producto_eliminado():
    catalogo = _Catalogo()
    cotizaciones = _Cotizaciones()
    inicializar_almacen(catalogo, cotizaciones)
    del catalogo.productos["hogar"]
    esquemas = catalogo.esquemas
    with (
        patch("cotizacion.container.PostgresCatalogoRepository", return_value=catalogo),
        patch("cotizacion.container.PostgresCotizacionRepository", return_value=cotizaciones),
        patch("cotizacion.container.seed_catalogo") as seed,
    ):
        contenedor = Container()
        seed.reset_mock()
        contenedor.use_postgres(MagicMock())

    seed.assert_not_called()
    assert catalogo.esquemas == esquemas
    assert catalogo.get_producto("hogar") is None
    assert {p.id for p in catalogo.list_productos()} == PRODUCTOS_SEED - {"hogar"}
    assert contenedor.catalogo is catalogo


def test_bootstrap_repetido_no_restaura_ni_duplica():
    catalogo = _Catalogo()
    cotizaciones = _Cotizaciones()
    inicializar_almacen(catalogo, cotizaciones)
    del catalogo.productos["hogar"]
    inicializar_almacen(catalogo, cotizaciones)
    assert catalogo.get_producto("hogar") is None
    assert {p.id for p in catalogo.list_productos()} == PRODUCTOS_SEED - {"hogar"}
    assert len(catalogo.list_ramos()) == 6
    assert catalogo.esquemas == 2
    assert cotizaciones.esquemas == 2


def test_tres_replicas_usan_bd_ya_inicializada_sin_crear_tablas():
    catalogo = _Catalogo()
    cotizaciones = _Cotizaciones()
    inicializar_almacen(catalogo, cotizaciones)
    del catalogo.productos["hogar"]
    esquemas_catalogo = catalogo.esquemas
    esquemas_cotizaciones = cotizaciones.esquemas
    engine = MagicMock()
    with (
        patch("cotizacion.container.PostgresCatalogoRepository", return_value=catalogo),
        patch("cotizacion.container.PostgresCotizacionRepository", return_value=cotizaciones),
        patch("cotizacion.container.seed_catalogo") as seed,
    ):
        for _ in range(3):
            replica = Container()
            seed.reset_mock()
            replica.use_postgres(engine)
            seed.assert_not_called()
            assert replica.catalogo is catalogo
            assert replica.cotizaciones is cotizaciones

    assert catalogo.esquemas == esquemas_catalogo
    assert cotizaciones.esquemas == esquemas_cotizaciones
    assert catalogo.get_producto("hogar") is None


@patch("cotizacion.bootstrap.seed_catalogo")
@patch("cotizacion.bootstrap.PostgresCotizacionRepository")
@patch("cotizacion.bootstrap.PostgresCatalogoRepository")
def test_bootstrap_crea_schema_y_no_siembra_catalogo_con_datos(catalogo_cls, cotizaciones_cls, seed):
    catalogo_cls.return_value.list_productos.return_value = [MagicMock()]
    engine = MagicMock()
    bootstrap(engine)
    catalogo_cls.assert_called_once_with(engine)
    cotizaciones_cls.assert_called_once_with(engine)
    catalogo_cls.return_value.create_schema.assert_called_once_with()
    cotizaciones_cls.return_value.create_schema.assert_called_once_with()
    seed.assert_not_called()


def test_main_exige_base_de_datos():
    with patch("cotizacion.bootstrap.settings") as settings, pytest.raises(SystemExit):
        settings.database_url = None
        main()


@patch("cotizacion.bootstrap.bootstrap")
@patch("cotizacion.bootstrap.build_engine")
@patch("cotizacion.bootstrap.settings")
def test_main_ejecuta_bootstrap_con_el_engine(settings, build_engine, bootstrap_fn):
    settings.database_url = "postgresql+psycopg://solventa:solventa@localhost/cotizacion"
    build_engine.return_value = MagicMock()
    main()
    build_engine.assert_called_once_with(settings.database_url)
    bootstrap_fn.assert_called_once_with(build_engine.return_value)
