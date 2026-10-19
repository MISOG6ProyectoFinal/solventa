"""Cobro de prima: resultado, persistencia, idempotencia y un solo intento a la pasarela."""

from decimal import Decimal

import httpx
import pytest
from fastapi.testclient import TestClient
from pagos.cobros.adapters.pasarela import (
    TOKEN_APROBADO,
    TOKEN_RECHAZADO,
    PasarelaPagosGateway,
    PasarelaSimulada,
    construir_pasarela,
)
from pagos.cobros.adapters.repository import InMemoryCobroRepository, PostgresCobroRepository
from pagos.cobros.adapters.repository import cobros as cobros_table
from pagos.cobros.api import casos, router, wire
from pagos.cobros.domain.models import EstadoCobro
from pagos.cobros.domain.ports import PasarelaNoDisponible
from pagos.config import settings
from pagos.main import app
from solventa_common.integration import PasarelaPagosAdapter
from sqlalchemy import create_engine, func, select
from sqlalchemy.pool import StaticPool

client = TestClient(app)


class _Pasarela:
    def __init__(self, estado: str = "aprobado", error: Exception | None = None) -> None:
        self.estado = estado
        self.error = error
        self.calls: list[tuple] = []

    def charge(self, amount: float, currency: str, token: str, idempotency_key: str) -> dict:
        self.calls.append((amount, currency, token, idempotency_key))
        if self.error:
            raise self.error
        return {"estado": self.estado}


def _solicitud(**cambios) -> dict:
    base = {
        "cotizacion_id": "oferta-1",
        "cliente_id": "cliente-demo",
        "monto": "149940.00",
        "moneda": "COP",
        "idempotency_key": "movil:cliente-demo:oferta-1",
        "medio_token": TOKEN_APROBADO,
    }
    return base | cambios


def _engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def test_pago_aprobado_por_la_pasarela_simulada():
    pasarela = PasarelaSimulada()
    wire(InMemoryCobroRepository(), pasarela)

    response = client.post("/pagos/cobros", json=_solicitud())

    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "aprobado"
    assert data["monto"] == "149940.00"
    assert data["moneda"] == "COP"
    assert data["idempotency_key"] == "movil:cliente-demo:oferta-1"
    assert pasarela.llamadas == 1


def test_pago_rechazado_por_la_pasarela_simulada():
    pasarela = PasarelaSimulada()
    wire(InMemoryCobroRepository(), pasarela)

    response = client.post("/pagos/cobros", json=_solicitud(medio_token=TOKEN_RECHAZADO))

    assert response.status_code == 200
    assert response.json()["estado"] == "rechazado"
    assert pasarela.llamadas == 1


def test_se_persiste_el_resultado():
    engine = _engine()
    repositorio = PostgresCobroRepository(engine)
    pasarela = _Pasarela("aprobado")
    wire(repositorio, pasarela)

    response = client.post("/pagos/cobros", json=_solicitud())

    assert response.status_code == 200
    with engine.connect() as conn:
        fila = conn.execute(select(cobros_table)).mappings().one()
    assert fila["estado"] == EstadoCobro.APROBADO
    assert fila["idempotency_key"] == "movil:cliente-demo:oferta-1"
    assert Decimal(fila["monto"]) == Decimal("149940.00")


def test_la_misma_clave_no_genera_otro_cobro_y_repite_el_resultado():
    pasarela = _Pasarela("rechazado")
    wire(InMemoryCobroRepository(), pasarela)
    body = _solicitud()

    primero = client.post("/pagos/cobros", json=body)
    segundo = client.post("/pagos/cobros", json=body)

    assert primero.status_code == 200
    assert segundo.status_code == 200
    assert segundo.json()["id"] == primero.json()["id"]
    assert segundo.json()["estado"] == "rechazado"
    assert len(pasarela.calls) == 1


def test_la_clave_repetida_en_persistencia_no_duplica_la_fila():
    engine = _engine()
    repositorio = PostgresCobroRepository(engine)
    pasarela = _Pasarela("aprobado")
    wire(repositorio, pasarela)
    body = _solicitud()

    primero = client.post("/pagos/cobros", json=body)
    segundo = client.post("/pagos/cobros", json=body)

    assert segundo.json()["id"] == primero.json()["id"]
    assert len(pasarela.calls) == 1
    with engine.connect() as conn:
        total = conn.execute(select(func.count()).select_from(cobros_table)).scalar_one()
    assert total == 1


def test_un_fallo_de_pasarela_no_se_reintenta():
    pasarela = _Pasarela(error=TimeoutError("timeout"))
    wire(InMemoryCobroRepository(), pasarela)

    primero = client.post("/pagos/cobros", json=_solicitud())
    segundo = client.post("/pagos/cobros", json=_solicitud())

    assert primero.status_code == 503
    assert primero.json()["detail"] == "Pasarela de pagos no disponible"
    assert len(pasarela.calls) == 1
    assert segundo.status_code == 200
    assert segundo.json()["estado"] == "procesando"
    assert len(pasarela.calls) == 1


def test_el_adapter_real_no_reintenta_y_el_gateway_lo_llama_una_vez():
    assert PasarelaPagosAdapter.retries == 0
    adapter = type("Adapter", (), {})()
    adapter.calls = []

    def charge(amount, currency, token, idempotency_key):
        adapter.calls.append((amount, currency, token, idempotency_key))
        return {"status": "approved"}

    adapter.charge = charge
    gateway = PasarelaPagosGateway(adapter)
    assert gateway.charge(10.0, "COP", TOKEN_APROBADO, "clave") == {"estado": "aprobado"}
    assert adapter.calls == [(10.0, "COP", TOKEN_APROBADO, "clave")]


def test_un_timeout_de_la_pasarela_no_reintenta(monkeypatch):
    llamadas = {"n": 0}

    class _Adapter:
        def charge(self, amount, currency, token, idempotency_key):
            llamadas["n"] += 1
            raise httpx.TimeoutException("timeout")

    gateway = PasarelaPagosGateway(_Adapter())
    with pytest.raises(PasarelaNoDisponible):
        gateway.charge(1.0, "COP", TOKEN_APROBADO, "clave")
    assert llamadas["n"] == 1
    monkeypatch.setattr(settings, "pasarela_url", None)
    assert isinstance(construir_pasarela(), PasarelaSimulada)


def test_con_url_se_usa_el_adapter_existente(monkeypatch):
    monkeypatch.setattr(settings, "pasarela_url", "https://pasarela.test")
    monkeypatch.setattr(settings, "pasarela_api_key", None)
    pasarela = construir_pasarela()
    assert isinstance(pasarela, PasarelaPagosGateway)
    assert pasarela.adapter.retries == 0


def test_no_acepta_un_numero_de_tarjeta():
    response = client.post("/pagos/cobros", json=_solicitud(medio_token="0000000000000000"))
    assert response.status_code == 422


def test_el_caso_de_uso_sigue_montado():
    assert router.prefix == "/pagos"
    assert "cobrar" in casos
