"""Las reglas de rating viven en la base, versionadas, y cada cotización guarda la versión usada."""

from datetime import date, timedelta

import pytest
from cotizacion.container import container
from cotizacion.main import app
from cotizacion.rating.adapters.repository import InMemoryRulesRepository, PostgresRulesRepository
from cotizacion.rating.adapters.seed import INITIAL_RULES, seed_rules
from cotizacion.rating.domain.rating import NoRulesPublished, RulesVersionAlreadyPublished
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

client = TestClient(app)

SALIDA = date.today() + timedelta(days=30)
VIAJE = {
    "producto_id": "viaje-internacional",
    "destino": "España",
    "fecha_salida": SALIDA.isoformat(),
    "fecha_regreso": (SALIDA + timedelta(days=14)).isoformat(),
    "viajeros": 1,
}


@pytest.fixture(params=["memoria", "sql"])
def repo(request):
    if request.param == "memoria":
        return InMemoryRulesRepository()
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    repository = PostgresRulesRepository(engine)
    repository.create_schema()
    return repository


@pytest.fixture
def isolated_rules():
    original = container.rules
    container.rules = InMemoryRulesRepository()
    seed_rules(container.rules)
    container._wire()
    yield
    container.rules = original
    container._wire()


def test_sin_reglas_publicadas_no_hay_vigente(repo):
    with pytest.raises(NoRulesPublished):
        repo.current()


def test_la_vigente_es_la_ultima_publicada_y_conserva_cada_valor(repo):
    repo.publish(INITIAL_RULES)
    nueva = INITIAL_RULES.model_copy(update={"version": "2026.11.0", "tasa_iva": INITIAL_RULES.tasa_iva + 1})

    repo.publish(nueva)

    assert repo.current() == nueva
    assert repo.versions() == ["2026.11.0", INITIAL_RULES.version]


def test_los_valores_decimales_sobreviven_al_guardado(repo):
    repo.publish(INITIAL_RULES)

    assert repo.current() == INITIAL_RULES


def test_una_version_no_se_publica_dos_veces(repo):
    repo.publish(INITIAL_RULES)

    with pytest.raises(RulesVersionAlreadyPublished):
        repo.publish(INITIAL_RULES)


def test_las_reglas_vigentes_se_consultan_por_api():
    response = client.get("/cotizaciones/reglas")

    assert response.status_code == 200
    assert response.json()["version"] == INITIAL_RULES.version
    assert response.json()["tarifa_viaje_por_dia"] == {"viaje-internacional": "9000"}
    assert client.get("/cotizaciones/").json()["reglas"] == INITIAL_RULES.version


def test_publicar_una_tarifa_cambia_la_prima_sin_redesplegar_y_deja_la_version_en_la_oferta(isolated_rules):
    antes = client.post("/consenso/cotizaciones", json=VIAJE, headers={"X-Canal": "web"}).json()
    nueva = INITIAL_RULES.model_dump(mode="json") | {
        "version": "2026.11.0",
        "tarifa_viaje_por_dia": {"viaje-internacional": "18000"},
    }

    publicada = client.post("/cotizaciones/reglas", json=nueva)
    despues = client.post("/consenso/cotizaciones", json=VIAJE, headers={"X-Canal": "web"}).json()

    assert publicada.status_code == 201
    assert antes["prima"] == "149940.00"
    assert antes["version_reglas"] == INITIAL_RULES.version
    assert despues["prima"] == "299880.00"
    assert despues["version_reglas"] == "2026.11.0"
    assert container.cotizaciones.get(antes["id"]).version_reglas == INITIAL_RULES.version
    assert client.get("/cotizaciones/reglas/versiones").json() == ["2026.11.0", INITIAL_RULES.version]


def test_publicar_una_version_repetida_responde_409():
    response = client.post("/cotizaciones/reglas", json=INITIAL_RULES.model_dump(mode="json"))

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "version_repetida"


def test_publicar_reglas_incompletas_responde_422():
    assert client.post("/cotizaciones/reglas", json={"version": "x"}).status_code == 422
