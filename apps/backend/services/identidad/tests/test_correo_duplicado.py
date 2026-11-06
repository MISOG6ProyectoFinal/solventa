"""Un correo que ya es de otro documento responde 409, no 500."""

import pytest
from fastapi.testclient import TestClient
from identidad.kyc.adapters.repository import PostgresClientRepository
from identidad.kyc.domain.models import Client
from identidad.main import app
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

client = TestClient(app)


def _consentimiento(documento: str, email: str) -> dict:
    return {
        "tipo_documento": "CC",
        "numero_documento": documento,
        "nombre": "Lina",
        "email": email,
        "canal": "sms",
        "contacto": "3001234567",
    }


def test_solicitar_consentimiento_con_el_correo_de_otro_documento_responde_409():
    assert client.post("/identidad/solicitar", json=_consentimiento("5550001", "lina@solventa.test")).status_code == 201

    response = client.post("/identidad/solicitar", json=_consentimiento("5550002", "lina@solventa.test"))

    assert response.status_code == 409
    assert response.json()["detail"] == "El correo ya está registrado con otro documento"


def test_el_mismo_documento_puede_volver_a_solicitar_con_su_correo():
    body = _consentimiento("5550003", "pedro@solventa.test")

    assert client.post("/identidad/solicitar", json=body).status_code == 201
    assert client.post("/identidad/solicitar", json=body).status_code == 201


def test_actualizar_un_cliente_con_un_correo_ajeno_es_un_conflicto():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    repo = PostgresClientRepository(engine)
    repo.create_schema()
    repo.add(Client(id="c1", email="ana@solventa.test", nombre="Ana", tipo_documento="CC", numero_documento="1"))
    repo.add(Client(id="c2", email="beto@solventa.test", nombre="Beto", tipo_documento="CC", numero_documento="2"))

    with pytest.raises(ValueError):
        repo.upsert(
            Client(id="c2", email="ana@solventa.test", nombre="Beto", tipo_documento="CC", numero_documento="2")
        )
