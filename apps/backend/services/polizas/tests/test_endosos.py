"""HU006: endoso de datos del asegurado. Guarda versión anterior y nueva y publica el evento de auditoría."""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from polizas.ciclo_vida.adapters.endorsement_types import PostgresEndorsementTypeRepository
from polizas.ciclo_vida.adapters.memory import InMemoryPolicyRepository
from polizas.ciclo_vida.adapters.repository import PostgresPolicyRepository
from polizas.ciclo_vida.api import wire
from polizas.ciclo_vida.domain.models import Policy, PolicyStatus, Validity
from polizas.main import app
from solventa_common.events import InMemoryEventPublisher
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

client = TestClient(app)

VIGENCIA = Validity(desde=date(2090, 1, 1), hasta=date(2090, 12, 31))
ANTES = {
    "nombre": "María Rodríguez",
    "telefono": "+57 300 123 4567",
    "correo": "maria@email.com",
    "direccion": "Calle 85",
}


class _Source:
    def get(self, resource_id: str) -> None:
        return None


def _policy(**changes) -> Policy:
    data = {
        "id": "poliza-1",
        "cotizacion_id": "cot-1",
        "cobro_id": "cobro-1",
        "producto_id": "viaje-internacional",
        "prima": Decimal("100.00"),
        "vigencia": VIGENCIA,
        "canal": "web",
        "idempotency_key": "clave-1",
        "emitida_en": datetime(2090, 1, 1, tzinfo=UTC),
    }
    return Policy(**{**data, **changes})


def _repositories():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    return [InMemoryPolicyRepository(), PostgresPolicyRepository(engine)]


@pytest.fixture(params=[0, 1], ids=["memoria", "sql"])
def bus(request):
    repository = _repositories()[request.param]
    if hasattr(repository, "create_schema"):
        repository.create_schema()
    repository.add(_policy())
    repository.add(
        _policy(id="poliza-2", cotizacion_id="cot-2", idempotency_key="clave-2", estado=PolicyStatus.CANCELLED)
    )
    publisher = InMemoryEventPublisher()
    wire(repository, _Source(), _Source(), publisher)
    return publisher


def _body(**changes) -> dict:
    data = {
        "usuario_id": "op-1",
        "fecha_efectiva": "2090-06-01",
        "motivo": "Actualización de teléfono",
        "datos_identidad": ANTES,
        "version_nueva": {**ANTES, "telefono": "+57 311 000 1122"},
    }
    return {**data, **changes}


def test_guarda_ambas_versiones_y_publica_el_evento(bus):
    response = client.post("/polizas/poliza-1/endosos", json=_body())

    assert response.status_code == 201
    saved = client.get("/polizas/poliza-1/endosos").json()
    assert saved[0]["version_anterior"]["telefono"] == "+57 300 123 4567"
    assert saved[0]["version_nueva"]["telefono"] == "+57 311 000 1122"
    assert (saved[0]["tipo"], saved[0]["tipo_nombre"]) == ("datos-asegurado", "Datos del asegurado")
    [event] = bus.events
    assert event.event_type == "poliza.endosada"
    assert event.payload["usuario_id"] == "op-1"
    assert event.payload["motivo"] == "Actualización de teléfono"
    assert event.payload["version_anterior"] == saved[0]["version_anterior"]


def test_poliza_cancelada_responde_409(bus):
    response = client.post("/polizas/poliza-2/endosos", json=_body())

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "poliza_no_endosable"
    assert bus.events == []


@pytest.mark.parametrize("motivo", ["", "   "])
def test_motivo_vacio_se_rechaza(bus, motivo):
    assert client.post("/polizas/poliza-1/endosos", json=_body(motivo=motivo)).status_code == 422


@pytest.mark.parametrize("fecha", ["2089-12-31", "2091-01-01"])
def test_fecha_fuera_de_la_vigencia_se_rechaza(bus, fecha):
    response = client.post("/polizas/poliza-1/endosos", json=_body(fecha_efectiva=fecha))

    assert response.status_code == 422
    assert response.json()["detail"]["codigo"] == "fecha_efectiva_fuera_de_vigencia"


def test_sin_cambios_se_rechaza(bus):
    response = client.post("/polizas/poliza-1/endosos", json=_body(version_nueva=ANTES))

    assert response.status_code == 422
    assert response.json()["detail"]["codigo"] == "endoso_sin_cambios"


def test_poliza_inexistente_responde_404(bus):
    assert client.post("/polizas/nope/endosos", json=_body()).status_code == 404


def test_catalogo_de_tipos_de_endoso_ramo_vida(bus):
    resp = client.get("/polizas/catalogos/tipos-endoso", params={"ramo_id": "ramo-vida"}).json()
    ids = [t["id"] for t in resp]
    assert ids == ["datos-asegurado", "beneficiarios", "suma-asegurada"]


def test_catalogo_de_tipos_de_endoso_ramo_patrimonial(bus):
    resp = client.get("/polizas/catalogos/tipos-endoso", params={"ramo_id": "ramo-hogar"}).json()
    ids = [t["id"] for t in resp]
    assert ids == ["datos-asegurado", "suma-asegurada"]


def test_catalogo_de_tipos_de_endoso_por_defecto(bus):
    assert client.get("/polizas/catalogos/tipos-endoso", params={"ramo_id": "ramo-viaje"}).json() == [
        {"id": "datos-asegurado", "nombre": "Datos del asegurado"}
    ]
    assert client.get("/polizas/catalogos/tipos-endoso").json() == [
        {"id": "datos-asegurado", "nombre": "Datos del asegurado"}
    ]


def test_los_tipos_de_endoso_se_siembran_una_vez_en_la_base():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    repository = PostgresEndorsementTypeRepository(engine)
    repository.create_schema()
    repository.create_schema()

    types = repository.list_types()
    assert [t.id for t in types] == ["datos-asegurado", "beneficiarios", "suma-asegurada"]
    assert types[0].applies_to("ramo-viaje")
    assert not types[1].applies_to("ramo-hogar")


def test_la_version_anterior_es_la_del_ultimo_endoso_aunque_identidad_diga_otra_cosa(bus):
    primero = {**ANTES, "telefono": "+57 311 000 1122"}
    segundo = {**ANTES, "telefono": "+57 322 999 0000"}
    client.post("/polizas/poliza-1/endosos", json={**_body(), "version_nueva": primero})

    response = client.post("/polizas/poliza-1/endosos", json={**_body(), "version_nueva": segundo})

    assert response.status_code == 201
    assert response.json()["version_anterior"]["telefono"] == "+57 311 000 1122"
    assert client.get("/polizas/poliza-1/asegurado").json()["asegurado"]["telefono"] == "+57 322 999 0000"


def test_sin_endosos_el_asegurado_vigente_es_el_de_identidad(bus):
    assert client.get("/polizas/poliza-1/asegurado").json() == {"asegurado": None}
    assert client.get("/polizas/nope/asegurado").status_code == 404


def test_un_endoso_igual_a_la_version_vigente_no_cambia_nada(bus):
    client.post("/polizas/poliza-1/endosos", json=_body())

    response = client.post("/polizas/poliza-1/endosos", json=_body())

    assert response.status_code == 422
    assert response.json()["detail"]["codigo"] == "endoso_sin_cambios"
