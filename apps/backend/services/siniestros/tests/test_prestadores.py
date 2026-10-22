import pytest
from fastapi.testclient import TestClient
from siniestros.main import app
from siniestros.prestadores import api as prestadores_api
from siniestros.prestadores.adapters.memory import InMemoryPrestadorRepository
from siniestros.prestadores.adapters.seed_catalog import SeedCatalog
from siniestros.prestadores.domain.eta import estimate_eta_min
from siniestros.prestadores.domain.models import ConsultaCercanos, Prestador
from siniestros.prestadores.domain.use_cases import BuscarCercanosUseCase, SincronizarCatalogoUseCase

client = TestClient(app)

BOGOTA = {"lat": 4.711, "lon": -74.0721}


def _prestador(origen_id: str, tipo: str, lat: float, lon: float, **extra) -> Prestador:
    return Prestador(
        origen=extra.pop("origen", "seed"),
        origen_id=origen_id,
        nombre=extra.pop("nombre", f"Prestador {origen_id}"),
        tipo=tipo,
        latitud=lat,
        longitud=lon,
        calificacion=extra.pop("calificacion", 4.5),
    )


CATALOGO = [
    _prestador("grua-cerca", "grua", 4.7130, -74.0700),  # ~0.3 km
    _prestador("taller-medio", "taller", 4.7290, -74.0721),  # ~2 km
    _prestador("perito-lejos", "perito", 4.7560, -74.0721),  # ~5 km
    _prestador("ambulancia-zipaquira", "ambulancia", 5.0227, -73.9966),  # ~35 km
    _prestador("grua-medellin", "grua", 6.2442, -75.5812),  # ~240 km
]


@pytest.fixture(autouse=True)
def _wired():
    repository = InMemoryPrestadorRepository()
    repository.upsert(CATALOGO)
    prestadores_api.wire(repository, [])


def _cercanos(**params):
    return client.get("/siniestros/prestadores/cercanos", params={**BOGOTA, **params})


def test_devuelve_los_prestadores_del_radio_del_mas_cercano_al_mas_lejano():
    response = _cercanos(radio_km=10)

    assert response.status_code == 200
    props = [feature["properties"] for feature in response.json()["features"]]
    assert [p["id"] for p in props] == ["seed-grua-cerca", "seed-taller-medio", "seed-perito-lejos"]
    distancias = [p["distancia_km"] for p in props]
    assert distancias == sorted(distancias)
    assert 0.2 <= distancias[0] <= 0.5
    assert 1.8 <= distancias[1] <= 2.2
    etas = [p["eta_min"] for p in props]
    assert etas == sorted(etas)
    assert all(isinstance(eta, int) and eta >= 6 for eta in etas)
    assert props[0]["calificacion"] == 4.5


def test_el_radio_por_defecto_es_10_km():
    ids = [f["properties"]["id"] for f in _cercanos().json()["features"]]

    assert "seed-perito-lejos" in ids
    assert "seed-ambulancia-zipaquira" not in ids


def test_filtra_por_tipo_de_servicio():
    response = _cercanos(radio_km=50, servicio="grua")

    tipos = {f["properties"]["tipo"] for f in response.json()["features"]}
    assert tipos == {"grua"}


def test_sin_servicio_devuelve_todas_las_categorias():
    response = _cercanos(radio_km=50)

    tipos = {f["properties"]["tipo"] for f in response.json()["features"]}
    assert tipos == {"grua", "taller", "perito", "ambulancia"}


def test_devuelve_como_maximo_50_prestadores():
    repository = InMemoryPrestadorRepository()
    repository.upsert([_prestador(f"grua-{n:02d}", "grua", 4.711 + n * 0.0005, -74.0721) for n in range(60)])
    prestadores_api.wire(repository, [])

    features = _cercanos(radio_km=50).json()["features"]

    assert len(features) == 50
    assert features[0]["properties"]["id"] == "seed-grua-00"


@pytest.mark.parametrize(
    "params",
    [
        {"lat": 91},
        {"lat": -91},
        {"lon": 181},
        {"lon": -181},
        {"radio_km": 51},
        {"radio_km": 0},
        {"radio_km": -1},
        {"servicio": "helicoptero"},
    ],
)
def test_rechaza_consultas_invalidas(params):
    assert _cercanos(**params).status_code == 422


@pytest.mark.parametrize("faltante", ["lat", "lon"])
def test_exige_latitud_y_longitud(faltante):
    params = {k: v for k, v in BOGOTA.items() if k != faltante}

    assert client.get("/siniestros/prestadores/cercanos", params=params).status_code == 422


def test_una_zona_sin_prestadores_responde_200_y_sin_features():
    response = client.get("/siniestros/prestadores/cercanos", params={"lat": -33.45, "lon": -70.66})

    assert response.status_code == 200
    assert response.json() == {"type": "FeatureCollection", "features": []}


def test_la_respuesta_es_una_feature_collection_con_coordenadas_lon_lat():
    body = _cercanos(radio_km=1).json()

    assert body["type"] == "FeatureCollection"
    feature = body["features"][0]
    assert feature["type"] == "Feature"
    assert feature["geometry"] == {"type": "Point", "coordinates": [-74.07, 4.713]}
    assert set(feature["properties"]) == {"id", "nombre", "tipo", "distancia_km", "eta_min", "calificacion"}


def test_un_prestador_sin_calificacion_la_devuelve_nula():
    repository = InMemoryPrestadorRepository()
    repository.upsert([_prestador("taller-osm", "taller", 4.712, -74.07, origen="osm", calificacion=None)])
    prestadores_api.wire(repository, [])

    feature = _cercanos().json()["features"][0]

    assert feature["properties"]["id"] == "osm-taller-osm"
    assert feature["properties"]["calificacion"] is None


@pytest.mark.parametrize(("distancia_km", "minutos"), [(0, 5), (2.4, 11), (10, 29), (25, 65)])
def test_la_llegada_estimada_suma_el_despacho_al_trayecto_urbano(distancia_km, minutos):
    assert estimate_eta_min(distancia_km) == minutos


def test_el_caso_de_uso_calcula_la_llegada_con_la_distancia_sin_redondear():
    repository = InMemoryPrestadorRepository()
    repository.upsert(CATALOGO)

    resultados = BuscarCercanosUseCase(repository).execute(ConsultaCercanos(**BOGOTA))

    for item in resultados:
        assert item.eta_min == estimate_eta_min(item.distancia_km)


class _FuenteFija:
    def __init__(self, prestadores: list[Prestador]) -> None:
        self.prestadores = prestadores

    def fetch(self) -> list[Prestador]:
        return self.prestadores


class _FuenteCaida:
    def fetch(self) -> list[Prestador]:
        raise TimeoutError("overpass no responde")


def test_sincronizar_dos_veces_deja_una_fila_por_origen_y_origen_id():
    repository = InMemoryPrestadorRepository()
    caso = SincronizarCatalogoUseCase(repository, [_FuenteFija(CATALOGO)])

    caso.execute()
    caso.execute()

    assert len(repository.prestadores) == len(CATALOGO)


def test_sincronizar_actualiza_la_fila_existente():
    repository = InMemoryPrestadorRepository()
    repository.upsert([_prestador("grua-1", "grua", 4.7, -74.0, calificacion=3.0)])

    nueva = _prestador("grua-1", "grua", 4.7, -74.0, calificacion=4.8)
    SincronizarCatalogoUseCase(repository, [_FuenteFija([nueva])]).execute()

    assert len(repository.prestadores) == 1
    assert next(iter(repository.prestadores.values())).calificacion == 4.8


def test_si_overpass_falla_se_carga_el_seed_y_se_conservan_las_filas_osm_previas():
    repository = InMemoryPrestadorRepository()
    previo = _prestador("node-1", "taller", 4.65, -74.1, origen="osm", calificacion=None)
    repository.upsert([previo])
    seed = _prestador("grua-1", "grua", 4.7, -74.0)

    cargados = SincronizarCatalogoUseCase(repository, [_FuenteFija([seed]), _FuenteCaida()]).execute()

    assert cargados == 1
    assert {("osm", "node-1"), ("seed", "grua-1")} == set(repository.prestadores)


def test_una_fuente_caida_antes_del_seed_tampoco_impide_cargarlo():
    repository = InMemoryPrestadorRepository()

    SincronizarCatalogoUseCase(repository, [_FuenteCaida(), _FuenteFija(CATALOGO)]).execute()

    assert len(repository.prestadores) == len(CATALOGO)


def test_el_seed_cubre_las_cuatro_categorias_dentro_de_bogota():
    prestadores = SeedCatalog().fetch()

    assert {p.tipo for p in prestadores} == {"grua", "taller", "perito", "ambulancia"}
    assert len({(p.origen, p.origen_id) for p in prestadores}) == len(prestadores)
    assert all(p.origen == "seed" and p.calificacion is not None for p in prestadores)
    assert all(4.45 <= p.latitud <= 4.85 and -74.25 <= p.longitud <= -73.98 for p in prestadores)


def test_sin_almacenes_persistentes_arranca_con_el_seed_cargado():
    prestadores_api._default_wire()

    features = _cercanos(radio_km=10).json()["features"]

    assert features
    assert all(f["properties"]["id"].startswith("seed-") for f in features)
