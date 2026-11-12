"""HU009: rotación y revocación de la credencial del socio."""

from datetime import UTC, datetime, timedelta

import pytest
from cotizacion.container import container
from cotizacion.gobierno_socios.adapters.repository import InMemorySocioRepository, PostgresSocioRepository
from cotizacion.gobierno_socios.domain import credenciales
from cotizacion.gobierno_socios.domain.credential_lifecycle import (
    RevokeCredentialUseCase,
    RotateCredentialUseCase,
    accepts_secret,
)
from cotizacion.gobierno_socios.domain.models import (
    Alcance,
    CredentialEventType,
    EstadoCredencial,
    Socio,
    TipoSocio,
)
from cotizacion.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

client = TestClient(app)

ALTA = {
    "nombre": "Fintech Rotación",
    "identificador": "FINTECH-ROTA",
    "tipo": "Fintech",
    "correo_contacto": "api@fintech.test",
    "alcances": ["consulta"],
    "autorizado_por": "Operación",
}
NOW = datetime(2026, 11, 11, 10, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def empty_stores():
    container.socios.socios.clear()
    container.socios.events.clear()
    container.quota_counter.windows.clear()


def partner() -> dict:
    response = client.post("/gobierno-socios/socios", json=ALTA)
    assert response.status_code == 201, response.text
    return response.json()


def call_with(client_id: str, secret: str) -> int:
    response = client.get(
        "/gobierno-socios/autorizacion",
        params={"alcance": "consulta"},
        headers={"X-Client-Id": client_id, "X-Api-Key": secret},
    )
    return response.status_code


def rotate(socio_id: str, **body) -> dict:
    response = client.post(f"/gobierno-socios/socios/{socio_id}/credencial/rotacion", json={"actor": "Ana", **body})
    assert response.status_code == 200, response.text
    return response.json()


def test_rotation_issues_a_new_secret_and_keeps_the_old_one_during_the_grace_window():
    socio = partner()

    rotated = rotate(socio["id"], gracia_minutos=30)

    assert rotated["secreto"] != socio["secreto"]
    assert rotated["secreto_enmascarado"].endswith(rotated["secreto"][-4:])
    assert rotated["gracia_hasta"] == rotated["secreto_anterior_vence"]
    assert call_with(socio["client_id"], rotated["secreto"]) == 200
    assert call_with(socio["client_id"], socio["secreto"]) == 200


def test_a_rotation_without_grace_invalidates_the_old_secret_at_once():
    socio = partner()

    rotated = rotate(socio["id"], gracia_minutos=0)

    assert rotated["gracia_hasta"] is None
    assert call_with(socio["client_id"], socio["secreto"]) == 401
    assert call_with(socio["client_id"], rotated["secreto"]) == 200


def test_revocation_rejects_every_call_from_that_moment():
    socio = partner()
    rotated = rotate(socio["id"], gracia_minutos=30)

    response = client.post(f"/gobierno-socios/socios/{socio['id']}/credencial/revocacion", json={"actor": "Ana"})

    assert response.status_code == 200
    assert response.json()["estado_credencial"] == "Revocada"
    assert call_with(socio["client_id"], rotated["secreto"]) == 401
    assert call_with(socio["client_id"], socio["secreto"]) == 401


def test_rotation_and_revocation_are_recorded_with_date_and_actor():
    socio = partner()
    rotate(socio["id"])
    client.post(f"/gobierno-socios/socios/{socio['id']}/credencial/revocacion", json={"actor": "Carlos"})

    events = client.get(f"/gobierno-socios/socios/{socio['id']}/credencial/eventos").json()

    assert [(event["tipo"], event["actor"]) for event in events] == [("revocada", "Carlos"), ("rotada", "Ana")]
    assert all(event["fecha"] for event in events)
    assert events[1]["gracia_hasta"] is not None


def test_an_unknown_partner_or_an_invalid_request_is_rejected():
    socio = partner()

    unknown = "/gobierno-socios/socios/no-existe/credencial"
    assert client.post(f"{unknown}/rotacion", json={"actor": "Ana"}).status_code == 404
    assert client.post(f"{unknown}/revocacion", json={"actor": "Ana"}).status_code == 404
    assert client.get(f"{unknown}/eventos").status_code == 404
    assert rotate_status(socio["id"], {"actor": "Ana", "gracia_minutos": -1}) == 422
    assert rotate_status(socio["id"], {"actor": ""}) == 422


def rotate_status(socio_id: str, body: dict) -> int:
    return client.post(f"/gobierno-socios/socios/{socio_id}/credencial/rotacion", json=body).status_code


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
        "secreto_hash": credenciales.hash_secreto("viejo"),
        "secreto_enmascarado": "sv_sec_••••••••iejo",
        "alta_fecha": NOW,
        "alta_usuario": "Operación",
    }
    return Socio(**{**base, **changes})


def test_the_old_secret_expires_when_the_grace_window_ends():
    clock = [NOW]
    socios = InMemorySocioRepository()
    socios.socios["s-1"] = domain_partner()
    rotation = RotateCredentialUseCase(socios, timedelta(minutes=10), now=lambda: clock[0])
    rotated, _secret = rotation.execute("s-1", "Ana")

    assert accepts_secret(rotated, "viejo", NOW + timedelta(minutes=9))
    assert not accepts_secret(rotated, "viejo", NOW + timedelta(minutes=10))


def test_rotating_a_revoked_credential_reactivates_it_without_grace_for_the_old_secret():
    socios = InMemorySocioRepository()
    socios.socios["s-1"] = domain_partner(estado_credencial=EstadoCredencial.REVOCADA)

    rotated, secret = RotateCredentialUseCase(socios, timedelta(minutes=10), now=lambda: NOW).execute("s-1", "Ana")

    assert rotated.estado_credencial == EstadoCredencial.ACTIVA
    assert rotated.secreto_anterior_hash is None
    assert accepts_secret(rotated, secret, NOW)
    assert not accepts_secret(rotated, "viejo", NOW)


def test_the_sql_repository_saves_the_credential_and_its_event_together():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    socios = PostgresSocioRepository(engine)
    socios.create_schema()
    socios.add(domain_partner())

    rotated, secret = RotateCredentialUseCase(socios, timedelta(minutes=10), now=lambda: NOW).execute("s-1", "Ana")
    RevokeCredentialUseCase(socios, now=lambda: NOW + timedelta(minutes=1)).execute("s-1", "Carlos")

    stored = socios.get("s-1")
    assert stored.estado_credencial == EstadoCredencial.REVOCADA
    assert stored.secreto_hash == credenciales.hash_secreto(secret)
    assert stored.secreto_anterior_hash is None
    assert [event.tipo for event in socios.credential_events("s-1")] == [
        CredentialEventType.ROTATED,
        CredentialEventType.REVOKED,
    ]
    assert rotated.secreto_anterior_vence == NOW + timedelta(minutes=10)


def test_the_schema_adds_the_new_columns_to_an_existing_partner_table():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE socios (id VARCHAR(36) PRIMARY KEY, nombre VARCHAR(120))"))

    PostgresSocioRepository(engine).create_schema()

    with engine.connect() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(socios)"))}
    assert {"secreto_anterior_hash", "secreto_anterior_vence"} <= columns
