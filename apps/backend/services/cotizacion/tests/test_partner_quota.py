"""HU011: cuota de consumo y aislamiento de carga por socio."""

import logging
from datetime import UTC, datetime, timedelta

import pytest
from cotizacion.container import container
from cotizacion.gobierno_socios.adapters.quota_repository import InMemoryQuotaCounter, PostgresQuotaCounter
from cotizacion.gobierno_socios.adapters.repository import InMemorySocioRepository, PostgresSocioRepository
from cotizacion.gobierno_socios.domain.models import Alcance, Socio, SocioNoEncontrado, TipoSocio
from cotizacion.gobierno_socios.domain.quota import (
    ConsumeQuotaUseCase,
    QuotaUsageQuery,
    UpdateQuotaUseCase,
    window_start,
)
from cotizacion.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

client = TestClient(app)

ALTA = {
    "tipo": "Banco",
    "pais": "Colombia",
    "correo_contacto": "api@socio.test",
    "alcances": ["cotizacion", "emision", "consulta"],
    "autorizado_por": "Operación",
}
NOW = datetime(2026, 11, 11, 10, 30, 15, tzinfo=UTC)


@pytest.fixture(autouse=True)
def empty_stores():
    container.socios.socios.clear()
    container.quota_counter.windows.clear()


def partner(identificador: str, cuota: int | None = None) -> dict:
    response = client.post(
        "/gobierno-socios/socios", json={**ALTA, "nombre": identificador, "identificador": identificador}
    )
    assert response.status_code == 201, response.text
    created = response.json()
    if cuota is not None:
        assert (
            client.put(f"/gobierno-socios/socios/{created['id']}/cuota", json={"cuota_consumo": cuota}).status_code
            == 200
        )
    return created


def authorize(socio: dict) -> dict:
    response = client.get(
        "/gobierno-socios/autorizacion",
        params={"alcance": "consulta"},
        headers={"X-Client-Id": socio["client_id"], "X-Api-Key": socio["secreto"]},
    )
    assert response.status_code == 200, response.text
    return response.json()["consumo"]


def test_a_partner_over_its_quota_is_not_allowed_and_the_others_keep_their_traffic():
    busy = partner("BANCO-PICO", cuota=2)
    quiet = partner("BANCO-NORMAL", cuota=2)

    usages = [authorize(busy) for _ in range(3)]

    assert [usage["permitido"] for usage in usages] == [True, True, False]
    assert usages[-1]["consumidas"] == 3
    assert usages[-1]["reinicia_en_s"] >= 1
    assert authorize(quiet)["permitido"] is True


def test_an_adjusted_quota_applies_to_the_next_calls():
    socio = partner("FINTECH-AJUSTE", cuota=1)
    authorize(socio)
    assert authorize(socio)["permitido"] is False

    response = client.put(f"/gobierno-socios/socios/{socio['id']}/cuota", json={"cuota_consumo": 5})

    assert response.status_code == 200
    assert response.json()["cuota_consumo"] == 5
    assert authorize(socio)["permitido"] is True


def test_consumption_near_the_quota_is_available_for_monitoring(caplog):
    socio = partner("RETAIL-MONITOREO", cuota=5)
    for _ in range(3):
        authorize(socio)
    assert client.get(f"/gobierno-socios/socios/{socio['id']}/consumo").json()["cerca_del_limite"] is False

    with caplog.at_level(logging.WARNING, logger="cotizacion.gobierno_socios.domain.quota"):
        authorize(socio)

    usage = client.get(f"/gobierno-socios/socios/{socio['id']}/consumo").json()
    assert usage == usage | {"cuota_consumo": 5, "consumidas": 4, "permitido": True, "cerca_del_limite": True}
    assert any(getattr(record, "socio_id", None) == socio["id"] for record in caplog.records)


def test_quota_must_be_positive_and_the_partner_must_exist():
    socio = partner("BANCO-VALIDA")

    assert client.put(f"/gobierno-socios/socios/{socio['id']}/cuota", json={"cuota_consumo": 0}).status_code == 422
    assert client.put("/gobierno-socios/socios/no-existe/cuota", json={"cuota_consumo": 10}).status_code == 404
    assert client.get("/gobierno-socios/socios/no-existe/consumo").status_code == 404


def domain_partner(**changes) -> Socio:
    base = {
        "id": "s-1",
        "nombre": "Fintech Demo",
        "identificador": "FINTECH-DEMO",
        "tipo": TipoSocio.FINTECH,
        "pais": "Colombia",
        "correo_contacto": "ops@fintech.demo",
        "alcances": [Alcance.CONSULTA],
        "client_id": "sv_live_fintechdemo_ab12",
        "secreto_hash": "a" * 64,
        "secreto_enmascarado": "sk_live_••••ab12",
        "cuota_consumo": 2,
        "alta_fecha": NOW,
        "alta_usuario": "Operación",
    }
    return Socio(**{**base, **changes})


def test_the_count_starts_again_in_the_next_minute():
    clock = [NOW]
    consume = ConsumeQuotaUseCase(InMemoryQuotaCounter(), now=lambda: clock[0])
    socio = domain_partner()

    for _ in range(3):
        usage = consume.execute(socio)
    assert usage.permitido is False
    assert usage.reinicia_en_s == 45

    clock[0] = NOW + timedelta(minutes=1)
    usage = consume.execute(socio)

    assert usage.permitido is True
    assert usage.consumidas == 1
    assert usage.ventana_inicio == window_start(clock[0])


def test_usage_query_and_update_reject_an_unknown_partner():
    socios = InMemorySocioRepository()

    with pytest.raises(SocioNoEncontrado):
        QuotaUsageQuery(socios, InMemoryQuotaCounter()).execute("s-x")
    with pytest.raises(SocioNoEncontrado):
        UpdateQuotaUseCase(socios).execute("s-x", 10)


@pytest.fixture
def engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def test_the_sql_counter_shares_the_window_and_drops_old_ones(engine):
    counter = PostgresQuotaCounter(engine)
    counter.create_schema()
    start = window_start(NOW)
    previous = start - timedelta(minutes=1)

    counter.increment("s-1", previous)
    assert [counter.increment("s-1", start) for _ in range(3)] == [1, 2, 3]
    assert counter.increment("s-2", start) == 1

    assert counter.count("s-1", start) == 3
    assert counter.count("s-1", previous) == 0
    assert counter.count("s-3", start) == 0


def test_the_sql_repository_updates_the_quota(engine):
    socios = PostgresSocioRepository(engine)
    socios.create_schema()
    socios.add(domain_partner())

    assert socios.update_quota("s-1", 50).cuota_consumo == 50
    assert socios.get("s-1").cuota_consumo == 50
    assert socios.update_quota("s-x", 50) is None
