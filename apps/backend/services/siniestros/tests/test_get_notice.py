"""HU016: lectura de un aviso por su identificador."""

from fastapi.testclient import TestClient
from siniestros.avisos.adapters.memory import InMemoryAvisoRepository, InMemoryObjectStore
from siniestros.avisos.api import wire
from siniestros.main import app

client = TestClient(app)

NOTICE = {
    "cliente_id": "cliente-1",
    "poliza_id": "pol-1",
    "tipo": "Robo",
    "ocurrido_en": "2026-10-20T15:00:00+00:00",
    "descripcion": "Me robaron el equipaje en el aeropuerto.",
}


def test_returns_the_notice_with_its_status():
    wire(InMemoryAvisoRepository(), InMemoryObjectStore(), bucket="evidencias")
    created = client.post("/siniestros/avisos", json=NOTICE).json()

    response = client.get(f"/siniestros/avisos/{created['id']}")

    assert response.status_code == 200
    assert response.json()["estado"] == "borrador"
    assert response.json()["poliza_id"] == "pol-1"


def test_unknown_notice_is_an_explicit_not_found():
    wire(InMemoryAvisoRepository(), InMemoryObjectStore(), bucket="evidencias")

    response = client.get("/siniestros/avisos/no-existe")

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "siniestro_no_encontrado"


def test_lists_the_notices_of_a_policy():
    wire(InMemoryAvisoRepository(), InMemoryObjectStore(), bucket="evidencias")
    created = client.post("/siniestros/avisos", json=NOTICE).json()
    client.post("/siniestros/avisos", json={**NOTICE, "poliza_id": "pol-2"})

    response = client.get("/siniestros/polizas/pol-1/avisos")

    assert response.status_code == 200
    assert [notice["id"] for notice in response.json()] == [created["id"]]
