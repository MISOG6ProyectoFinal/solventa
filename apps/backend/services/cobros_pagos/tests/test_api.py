from cobros_pagos.entrypoints.api import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_live():
    assert client.get("/health/live").json()["service"] == "cobros-pagos"


def test_info():
    assert client.get("/pagos/").status_code == 200
