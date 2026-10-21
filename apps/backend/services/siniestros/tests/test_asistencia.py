from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from siniestros.asistencia import api as asistencia_api
from siniestros.asistencia.adapters.dispatcher import PrototypeDispatcher
from siniestros.asistencia.adapters.memory import InMemoryAsistenciaRepository
from siniestros.avisos import api as avisos_api
from siniestros.avisos.adapters.memory import InMemoryAvisoRepository, InMemoryObjectStore
from siniestros.main import app
from solventa_common.events import InMemoryEventPublisher

client = TestClient(app)

AVISO = {
    "cliente_id": "cliente-1",
    "poliza_id": "SLV-2026-03105",
    "tipo": "choque",
    "ocurrido_en": "2026-10-01T00:00:00Z",
    "descripcion": "Golpe en la puerta",
}
CLIENTE = {"X-Cliente-Id": "cliente-1"}
OTRO = {"X-Cliente-Id": "cliente-2"}
SOLICITUD = {
    "servicio": "perito",
    "ubicacion": "Calle 85 #12-34, Chapinero, Bogotá",
    "gps": "GPS 4.6683, -74.0531 (±8 m)",
}


@pytest.fixture
def publisher() -> InMemoryEventPublisher:
    return InMemoryEventPublisher()


@pytest.fixture(autouse=True)
def _wired(publisher):
    avisos = InMemoryAvisoRepository()
    avisos_api.wire(avisos, InMemoryObjectStore(), bucket="solventa-evidencias")
    asistencia_api.wire(avisos, InMemoryAsistenciaRepository(), publisher, PrototypeDispatcher())


def _aviso(*, radicado: bool = True) -> str:
    aviso = avisos_api.casos["crear"].execute(**{**AVISO, "ocurrido_en": datetime(2026, 10, 1, tzinfo=UTC)})
    if radicado:
        avisos_api.repository.update_aviso(aviso.model_copy(update={"estado": "radicado", "radicado": "SIN-12345"}))
    return aviso.id


def _solicitar(aviso_id: str, body: dict | None = None, headers: dict | None = None):
    return client.post(f"/siniestros/avisos/{aviso_id}/asistencias", json=body or SOLICITUD, headers=headers or CLIENTE)


def test_modulo_montado():
    assert client.get("/siniestros/asistencias").json() == {"component": "Asistencia en sitio"}


def test_un_aviso_radicado_recibe_numero_servicio_y_llegada_estimada():
    response = _solicitar(_aviso())

    assert response.status_code == 201
    body = response.json()
    assert body["numero"].startswith("AST-")
    assert body["servicio"] == "perito"
    assert body["estado"] == "solicitada"
    assert (body["eta_min"], body["eta_max"]) == (25, 40)
    assert body["ubicacion"] == SOLICITUD["ubicacion"]
    assert body["gps"] == SOLICITUD["gps"]


def test_el_evento_se_publica_una_vez_con_servicio_y_ubicacion(publisher):
    aviso_id = _aviso()

    created = _solicitar(aviso_id).json()

    assert len(publisher.events) == 1
    event = publisher.events[0]
    assert event.event_type == "AssistanceDispatchedEvent"
    assert event.source == "siniestros"
    assert event.idempotency_key == f"asistencia:{aviso_id}"
    assert event.payload == {
        "asistencia_id": created["id"],
        "numero": created["numero"],
        "aviso_id": aviso_id,
        "poliza_id": AVISO["poliza_id"],
        "cliente_id": "cliente-1",
        "servicio": "perito",
        "ubicacion": SOLICITUD["ubicacion"],
        "gps": SOLICITUD["gps"],
    }


def test_un_aviso_en_borrador_responde_409_y_no_publica(publisher):
    response = _solicitar(_aviso(radicado=False))

    assert response.status_code == 409
    assert response.json()["detail"] == "Radica el siniestro antes de solicitar asistencia."
    assert publisher.events == []


def test_el_aviso_de_otro_cliente_responde_404_y_no_publica(publisher):
    response = _solicitar(_aviso(), headers=OTRO)

    assert response.status_code == 404
    assert publisher.events == []


def test_un_aviso_inexistente_responde_404():
    assert _solicitar("no-existe").status_code == 404


@pytest.mark.parametrize("body", [{**SOLICITUD, "servicio": "taxi"}, {**SOLICITUD, "ubicacion": " "}])
def test_una_solicitud_invalida_responde_422(body, publisher):
    assert _solicitar(_aviso(), body).status_code == 422
    assert publisher.events == []


def test_una_segunda_solicitud_responde_409_y_no_publica_otro_evento(publisher):
    aviso_id = _aviso()
    _solicitar(aviso_id)

    again = _solicitar(aviso_id, {**SOLICITUD, "servicio": "grua"})

    assert again.status_code == 409
    assert again.json()["detail"] == "Ya solicitaste asistencia para este siniestro."
    assert len(publisher.events) == 1


def test_el_listado_devuelve_la_solicitud_o_una_lista_vacia():
    aviso_id = _aviso()
    assert client.get(f"/siniestros/avisos/{aviso_id}/asistencias", headers=CLIENTE).json() == []

    created = _solicitar(aviso_id).json()

    listed = client.get(f"/siniestros/avisos/{aviso_id}/asistencias", headers=CLIENTE)
    assert listed.status_code == 200
    assert listed.json() == [created]


def test_el_listado_del_aviso_de_otro_cliente_responde_404():
    aviso_id = _aviso()

    assert client.get(f"/siniestros/avisos/{aviso_id}/asistencias", headers=OTRO).status_code == 404


def test_el_numero_no_se_repite():
    numeros = iter(["AST-1111", "AST-1111", "AST-2222"])
    dispatcher = PrototypeDispatcher(lambda: next(numeros))
    asistencia_api.wire(avisos_api.repository, InMemoryAsistenciaRepository(), InMemoryEventPublisher(), dispatcher)

    first = _solicitar(_aviso()).json()
    second = _solicitar(_aviso()).json()

    assert first["numero"] == "AST-1111"
    assert second["numero"] == "AST-2222"
