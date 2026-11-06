"""El bootstrap inicializa la BD una vez. El arranque de las réplicas solo se conecta."""

from unittest.mock import MagicMock, patch

import pytest
from cotizacion.bootstrap import bootstrap, inicializar_almacen, main
from cotizacion.catalogo.adapters.repository import InMemoryCatalogoRepository
from cotizacion.catalogo.domain.models import Canal
from cotizacion.consenso.adapters.cotizacion_repository import InMemoryCotizacionRepository
from cotizacion.container import Container
from cotizacion.rating.adapters.repository import InMemoryRulesRepository
from cotizacion.rating.adapters.seed import INITIAL_RULES


class _Catalogo(InMemoryCatalogoRepository):
    def __init__(self) -> None:
        super().__init__()
        self.esquemas = 0

    def create_schema(self) -> None:
        self.esquemas += 1


class _Rules(InMemoryRulesRepository):
    def __init__(self) -> None:
        super().__init__()
        self.schemas = 0

    def create_schema(self) -> None:
        self.schemas += 1


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
        patch("cotizacion.container.PostgresRulesRepository") as rules_cls,
        patch("cotizacion.container.PostgresCotizacionRepository") as cotizaciones_cls,
        patch("cotizacion.container.PostgresSocioRepository") as socios_cls,
        patch("cotizacion.container.PostgresConfiguracionRepository") as configuraciones_cls,
        patch("cotizacion.container.seed_catalogo") as seed,
    ):
        contenedor = Container()
        seed.reset_mock()
        contenedor.use_postgres(engine)

    seed.assert_not_called()
    catalogo_cls.return_value.create_schema.assert_not_called()
    rules_cls.return_value.create_schema.assert_not_called()
    assert contenedor.rules is rules_cls.return_value
    cotizaciones_cls.return_value.create_schema.assert_not_called()
    socios_cls.return_value.create_schema.assert_not_called()
    socios_cls.assert_called_once_with(engine)
    configuraciones_cls.assert_called_once_with(engine)
    configuraciones_cls.return_value.create_schema.assert_not_called()
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
    "parametrico-clima-vuelo",
    "proteccion-pagos",
    "vida-hipotecario",
}


def test_bootstrap_crea_schema_e_inserta_dataset_inicial():
    catalogo = _Catalogo()
    cotizaciones = _Cotizaciones()
    inicializar_almacen(catalogo, _Rules(), cotizaciones)
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


def test_dataset_inicial_marca_los_canales_de_cada_producto():
    catalogo = _Catalogo()
    inicializar_almacen(catalogo, _Rules(), _Cotizaciones())
    canales = {p.id: set(p.canales) for p in catalogo.list_productos()}
    assert canales["viaje-internacional"] == {Canal.MOBILE, Canal.WEB, Canal.SOCIOS}
    assert canales["proteccion-celular"] == {Canal.SOCIOS}
    assert canales["vida-esencial"] == {Canal.WEB, Canal.SOCIOS}
    assert canales["hogar"] == set()


def test_dataset_inicial_marca_que_producto_exige_consentimiento():
    catalogo = _Catalogo()
    inicializar_almacen(catalogo, _Rules(), _Cotizaciones())
    exigen = {p.id for p in catalogo.list_productos() if p.requiere_consentimiento}
    assert exigen == {"vida-hipotecario"}


def test_el_bootstrap_publica_las_reglas_iniciales_una_sola_vez():
    reglas = _Rules()
    inicializar_almacen(_Catalogo(), reglas, _Cotizaciones())
    inicializar_almacen(_Catalogo(), reglas, _Cotizaciones())
    assert reglas.versions() == [INITIAL_RULES.version]
    assert reglas.schemas == 2


def test_startup_no_reinserta_producto_eliminado():
    catalogo = _Catalogo()
    cotizaciones = _Cotizaciones()
    inicializar_almacen(catalogo, _Rules(), cotizaciones)
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
    inicializar_almacen(catalogo, _Rules(), cotizaciones)
    del catalogo.productos["hogar"]
    inicializar_almacen(catalogo, _Rules(), cotizaciones)
    assert catalogo.get_producto("hogar") is None
    assert {p.id for p in catalogo.list_productos()} == PRODUCTOS_SEED - {"hogar"}
    assert len(catalogo.list_ramos()) == 9
    assert catalogo.esquemas == 2
    assert cotizaciones.esquemas == 2


def test_tres_replicas_usan_bd_ya_inicializada_sin_crear_tablas():
    catalogo = _Catalogo()
    cotizaciones = _Cotizaciones()
    inicializar_almacen(catalogo, _Rules(), cotizaciones)
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


@patch("cotizacion.bootstrap.seed_rules")
@patch("cotizacion.bootstrap.PostgresRulesRepository")
@patch("cotizacion.bootstrap.seed_catalogo")
@patch("cotizacion.bootstrap.PostgresConfiguracionRepository")
@patch("cotizacion.bootstrap.PostgresSocioRepository")
@patch("cotizacion.bootstrap.PostgresCotizacionRepository")
@patch("cotizacion.bootstrap.PostgresCatalogoRepository")
def test_bootstrap_crea_schema_y_no_siembra_catalogo_con_datos(
    catalogo_cls, cotizaciones_cls, socios_cls, configuraciones_cls, seed, rules_cls, seed_rules
):
    catalogo_cls.return_value.list_productos.return_value = [MagicMock()]
    rules_cls.return_value.versions.return_value = ["2026.10.0"]
    engine = MagicMock()
    bootstrap(engine)
    catalogo_cls.assert_called_once_with(engine)
    cotizaciones_cls.assert_called_once_with(engine)
    socios_cls.assert_called_once_with(engine)
    catalogo_cls.return_value.create_schema.assert_called_once_with()
    cotizaciones_cls.return_value.create_schema.assert_called_once_with()
    socios_cls.return_value.create_schema.assert_called_once_with()
    configuraciones_cls.assert_called_once_with(engine)
    configuraciones_cls.return_value.create_schema.assert_called_once_with()
    rules_cls.return_value.create_schema.assert_called_once_with()
    seed.assert_not_called()
    seed_rules.assert_not_called()


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
