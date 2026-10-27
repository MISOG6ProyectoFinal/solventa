"""Cobro de prima: resultado, persistencia, idempotencia y reconciliación del intento."""

import threading
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
from pagos.cobros.domain.models import EstadoCobro, SolicitudCobro
from pagos.cobros.domain.ports import PasarelaNoDisponible
from pagos.cobros.domain.use_cases import CobrarPrimaUseCase
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


def test_un_fallo_deja_procesando_y_la_misma_clave_vuelve_a_consultar_la_pasarela():
    pasarela = _Pasarela(error=TimeoutError("timeout"))
    repositorio = InMemoryCobroRepository()
    wire(repositorio, pasarela)
    body = _solicitud()

    primero = client.post("/pagos/cobros", json=body)

    assert primero.status_code == 503
    assert primero.json()["detail"] == "Pasarela de pagos no disponible"
    assert len(pasarela.calls) == 1
    assert len(repositorio.items) == 1
    cobro = next(iter(repositorio.items.values()))
    assert cobro.estado == EstadoCobro.PROCESANDO

    pasarela.error = None
    pasarela.estado = "aprobado"
    segundo = client.post("/pagos/cobros", json=body)

    assert segundo.status_code == 200
    assert segundo.json()["estado"] == "aprobado"
    assert segundo.json()["id"] == cobro.id
    assert len(repositorio.items) == 1
    assert pasarela.calls[0][3] == pasarela.calls[1][3] == body["idempotency_key"]
    assert cobro.estado == EstadoCobro.APROBADO


def test_si_la_reconciliacion_vuelve_a_fallar_sigue_procesando():
    pasarela = _Pasarela(error=TimeoutError("timeout"))
    repositorio = InMemoryCobroRepository()
    wire(repositorio, pasarela)
    body = _solicitud()

    client.post("/pagos/cobros", json=body)
    segundo = client.post("/pagos/cobros", json=body)

    assert segundo.status_code == 503
    assert len(pasarela.calls) == 2
    assert len(repositorio.items) == 1
    assert next(iter(repositorio.items.values())).estado == EstadoCobro.PROCESANDO
    assert pasarela.calls[0][3] == pasarela.calls[1][3]


def test_un_aprobado_existente_no_vuelve_a_llamar_la_pasarela():
    pasarela = _Pasarela("aprobado")
    wire(InMemoryCobroRepository(), pasarela)
    body = _solicitud()

    primero = client.post("/pagos/cobros", json=body)
    segundo = client.post("/pagos/cobros", json=_solicitud(idempotency_key="movil:oferta-1:otro-intento"))

    assert segundo.status_code == 200
    assert segundo.json()["id"] == primero.json()["id"]
    assert segundo.json()["estado"] == "aprobado"
    assert len(pasarela.calls) == 1


def test_un_rechazado_con_la_misma_clave_no_vuelve_a_llamar_la_pasarela():
    pasarela = _Pasarela("rechazado")
    wire(InMemoryCobroRepository(), pasarela)
    body = _solicitud()

    client.post("/pagos/cobros", json=body)
    segundo = client.post("/pagos/cobros", json=body)

    assert segundo.json()["estado"] == "rechazado"
    assert len(pasarela.calls) == 1


def test_un_rechazo_permite_un_intento_nuevo_con_otra_clave():
    pasarela = _Pasarela("rechazado")
    repositorio = InMemoryCobroRepository()
    wire(repositorio, pasarela)

    primero = client.post("/pagos/cobros", json=_solicitud(idempotency_key="movil:oferta-1:intento-1"))
    pasarela.estado = "aprobado"
    segundo = client.post("/pagos/cobros", json=_solicitud(idempotency_key="movil:oferta-1:intento-2"))

    assert primero.json()["estado"] == "rechazado"
    assert segundo.status_code == 200
    assert segundo.json()["estado"] == "aprobado"
    assert segundo.json()["id"] == primero.json()["id"]
    assert len(repositorio.items) == 1
    assert [llamada[3] for llamada in pasarela.calls] == ["movil:oferta-1:intento-1", "movil:oferta-1:intento-2"]


def test_dos_intentos_distintos_no_dejan_dos_cobros_aprobados():
    entered = threading.Event()
    release = threading.Event()
    calls: list[str] = []

    class _PasarelaEnVuelo:
        def charge(self, amount: float, currency: str, token: str, idempotency_key: str) -> dict:
            calls.append(idempotency_key)
            if len(calls) == 1:
                entered.set()
                assert release.wait(2)
            return {"estado": "aprobado"}

    repositorio = InMemoryCobroRepository()
    caso = CobrarPrimaUseCase(repositorio, _PasarelaEnVuelo())
    resultado: dict = {}

    def primero() -> None:
        resultado["a"] = caso.execute(SolicitudCobro.model_validate(_solicitud(idempotency_key="movil:oferta-1:a")))

    hilo = threading.Thread(target=primero)
    hilo.start()
    assert entered.wait(2)
    segundo = caso.execute(SolicitudCobro.model_validate(_solicitud(idempotency_key="movil:oferta-1:b")))
    release.set()
    hilo.join(2)

    assert resultado["a"].id == segundo.id
    assert resultado["a"].estado == EstadoCobro.APROBADO
    assert segundo.estado == EstadoCobro.APROBADO
    assert len(repositorio.items) == 1
    assert calls == ["movil:oferta-1:a", "movil:oferta-1:a"]


def test_la_misma_clave_en_postgres_no_duplica_la_fila_al_reconciliar():
    engine = _engine()
    repositorio = PostgresCobroRepository(engine)
    pasarela = _Pasarela(error=TimeoutError("timeout"))
    wire(repositorio, pasarela)
    body = _solicitud(idempotency_key="movil:oferta-1:intento-1")

    assert client.post("/pagos/cobros", json=body).status_code == 503
    pasarela.error = None
    pasarela.estado = "aprobado"
    segundo = client.post("/pagos/cobros", json=body)

    assert segundo.status_code == 200
    assert segundo.json()["estado"] == "aprobado"
    with engine.connect() as conn:
        total = conn.execute(select(func.count()).select_from(cobros_table)).scalar_one()
        filas = conn.execute(select(cobros_table.c.estado, cobros_table.c.idempotency_key)).mappings().all()
    assert total == 1
    assert filas[0]["estado"] == EstadoCobro.APROBADO
    assert filas[0]["idempotency_key"] == "movil:oferta-1:intento-1"
    assert [llamada[3] for llamada in pasarela.calls] == [body["idempotency_key"], body["idempotency_key"]]


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


def test_payment_can_be_read_by_id():
    wire(InMemoryCobroRepository(), PasarelaSimulada())
    created = client.post("/pagos/cobros", json=_solicitud()).json()

    response = client.get(f"/pagos/cobros/{created['id']}")

    assert response.status_code == 200
    assert response.json()["estado"] == "aprobado"
    assert response.json()["cotizacion_id"] == "oferta-1"
    assert response.json()["cliente_id"] == "cliente-demo"


def test_postgres_reads_payment_by_id():
    repository = PostgresCobroRepository(_engine())
    wire(repository, PasarelaSimulada())
    created = client.post("/pagos/cobros", json=_solicitud()).json()

    assert repository.get(created["id"]).estado is EstadoCobro.APROBADO
    assert repository.get("no-existe") is None


def test_unknown_payment_returns_404():
    wire(InMemoryCobroRepository(), PasarelaSimulada())

    response = client.get("/pagos/cobros/no-existe")

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "cobro_no_encontrado"
