from fastapi.testclient import TestClient
from polizas.main import app

client = TestClient(app)


def test_los_estados_de_una_poliza_se_leen_del_servicio():
    response = client.get("/polizas/catalogos/estados")

    assert response.status_code == 200
    assert response.json() == [
        {"id": "activa", "nombre": "Activa"},
        {"id": "vencida", "nombre": "Vencida"},
        {"id": "cancelada", "nombre": "Cancelada"},
    ]


def test_las_causas_de_cancelacion_dicen_si_devuelven_prima():
    response = client.get("/polizas/catalogos/causas-cancelacion")

    assert response.status_code == 200
    causes = response.json()
    assert [cause["nombre"] for cause in causes] == [
        "Retracto",
        "Venta del bien asegurado",
        "Insatisfacción con el servicio",
        "Pago anticipado del crédito asociado",
        "Impago de prima",
    ]
    assert [cause["id"] for cause in causes if not cause["reembolsable"]] == ["impago-de-prima"]
