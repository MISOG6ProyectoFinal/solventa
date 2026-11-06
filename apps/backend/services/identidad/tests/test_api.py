from fastapi.testclient import TestClient
from identidad.main import app

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "identidad"


def test_modulos_montados():
    assert client.get("/identidad/").status_code == 200
    assert client.get("/perfiles/").status_code == 200


def test_client_can_be_read_by_id():
    created = client.post(
        "/identidad/clientes/asegurar",
        json={"tipo_documento": "CC", "numero_documento": "7770001", "nombre": "Rosa", "email": "rosa@solventa.test"},
    )
    assert created.status_code == 200

    response = client.get(f"/identidad/clientes/{created.json()['id']}")

    assert response.status_code == 200
    assert response.json()["numero_documento"] == "7770001"
    assert response.json()["nombre"] == "Rosa"
    assert client.get("/identidad/clientes/no-existe").status_code == 404
