"""ASR-09: a database failover loses no confirmed payment and charges no payment twice."""

from datetime import UTC, datetime, timedelta

import httpx
from fastapi.testclient import TestClient
from pagos.cobros.adapters.pasarela import PasarelaPagosGateway
from pagos.cobros.adapters.repository import InMemoryCobroRepository, PostgresCobroRepository
from pagos.cobros.api import wire
from pagos.cobros.domain.models import Cobro, EstadoCobro, TipoReferencia
from pagos.cobros.domain.ports import PasarelaNoDisponible
from pagos.cobros.domain.use_cases import ReconciliarCobrosUseCase
from pagos.main import app
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool

client = TestClient(app)

NOW = datetime(2026, 11, 20, 12, 0, tzinfo=UTC)
THRESHOLD = timedelta(minutes=2)


def _lost_connection() -> OperationalError:
    return OperationalError("UPDATE cobros", {}, Exception("server closed the connection unexpectedly"))


class IdempotentGateway:
    """Behaves like the real gateway: one charge per key, replays return the first result."""

    def __init__(self, estado: str = "aprobado") -> None:
        self.estado = estado
        self.charges: dict[str, dict] = {}
        self.calls: list[str] = []
        self.down = False

    def charge(self, amount: float, currency: str, token: str, idempotency_key: str) -> dict:
        self.calls.append(idempotency_key)
        self.charges.setdefault(idempotency_key, {"estado": self.estado})
        return self.charges[idempotency_key]

    def lookup(self, idempotency_key: str) -> dict | None:
        if self.down:
            raise PasarelaNoDisponible("Pasarela de pagos no disponible")
        return self.charges.get(idempotency_key)


class DatabaseDown(InMemoryCobroRepository):
    def get_by_idempotency_key(self, idempotency_key: str):
        raise _lost_connection()


class FailsOnFirstUpdate(InMemoryCobroRepository):
    """The failover lands after the gateway charged and before the result is saved."""

    def __init__(self) -> None:
        super().__init__()
        self.failed = False

    def update(self, cobro: Cobro) -> None:
        if not self.failed:
            self.failed = True
            raise _lost_connection()
        super().update(cobro)


def _request(**changes) -> dict:
    base = {
        "cotizacion_id": "oferta-9",
        "cliente_id": "cliente-demo",
        "monto": "149940.00",
        "moneda": "COP",
        "idempotency_key": "asr09:oferta-9:a",
        "medio_token": "demo-4242",
    }
    return base | changes


def _pending(key: str, created: datetime, referencia: str | None = None) -> Cobro:
    return Cobro(
        tipo_referencia=TipoReferencia.COTIZACION,
        referencia_id=referencia or key,
        cotizacion_id=referencia or key,
        cliente_id="cliente-demo",
        monto="1000.00",
        moneda="COP",
        estado=EstadoCobro.PROCESANDO,
        idempotency_key=key,
        creado_en=created,
    )


def _engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def test_lost_database_connection_returns_503_with_retry_after():
    wire(DatabaseDown(), IdempotentGateway())

    response = client.post("/pagos/cobros", json=_request())

    assert response.status_code == 503
    assert response.headers["Retry-After"] == "2"
    assert response.json()["detail"]["codigo"] == "base_no_disponible"


def test_retry_after_failover_between_charge_and_save_charges_once():
    gateway = IdempotentGateway()
    repository = FailsOnFirstUpdate()
    wire(repository, gateway)
    body = _request()

    first = client.post("/pagos/cobros", json=body)
    second = client.post("/pagos/cobros", json=body)

    assert first.status_code == 503
    assert second.status_code == 200
    assert second.json()["estado"] == "aprobado"
    assert list(gateway.charges) == [body["idempotency_key"]]
    assert repository.get_by_idempotency_key(body["idempotency_key"]).estado == EstadoCobro.APROBADO


def test_retry_with_new_key_while_processing_charges_once_with_original_key():
    gateway = IdempotentGateway()
    wire(FailsOnFirstUpdate(), gateway)

    client.post("/pagos/cobros", json=_request(idempotency_key="asr09:oferta-9:a"))
    second = client.post("/pagos/cobros", json=_request(idempotency_key="asr09:oferta-9:b"))

    assert second.status_code == 200
    assert second.json()["estado"] == "aprobado"
    assert second.json()["idempotency_key"] == "asr09:oferta-9:a"
    assert list(gateway.charges) == ["asr09:oferta-9:a"]


def _reconcile(repository, gateway) -> list[Cobro]:
    return ReconciliarCobrosUseCase(repository, gateway, antiguedad=THRESHOLD, now=lambda: NOW).execute()


def test_reconciliation_closes_old_processing_payments_and_keeps_recent_ones():
    repository = InMemoryCobroRepository()
    gateway = IdempotentGateway()
    gateway.charges["old-charged"] = {"estado": "aprobado"}
    repository.add(_pending("old-charged", NOW - timedelta(minutes=5)))
    repository.add(_pending("old-never-charged", NOW - timedelta(minutes=5)))
    repository.add(_pending("recent", NOW - timedelta(seconds=30)))

    closed = _reconcile(repository, gateway)

    assert {cobro.idempotency_key for cobro in closed} == {"old-charged", "old-never-charged"}
    assert repository.get_by_idempotency_key("old-charged").estado == EstadoCobro.APROBADO
    assert repository.get_by_idempotency_key("old-never-charged").estado == EstadoCobro.RECHAZADO
    assert repository.get_by_idempotency_key("recent").estado == EstadoCobro.PROCESANDO
    assert gateway.calls == []


def test_reconciliation_twice_does_not_charge_again():
    repository = InMemoryCobroRepository()
    gateway = IdempotentGateway()
    gateway.charges["old"] = {"estado": "aprobado"}
    repository.add(_pending("old", NOW - timedelta(minutes=5)))

    _reconcile(repository, gateway)
    second = _reconcile(repository, gateway)

    assert second == []
    assert gateway.calls == []
    assert repository.get_by_idempotency_key("old").estado == EstadoCobro.APROBADO


def test_reconciliation_leaves_payment_processing_when_gateway_is_down():
    repository = InMemoryCobroRepository()
    gateway = IdempotentGateway()
    gateway.down = True
    repository.add(_pending("old", NOW - timedelta(minutes=5)))

    assert _reconcile(repository, gateway) == []
    assert repository.get_by_idempotency_key("old").estado == EstadoCobro.PROCESANDO


def test_rejected_by_reconciliation_allows_a_new_attempt():
    repository = InMemoryCobroRepository()
    gateway = IdempotentGateway()
    repository.add(_pending("asr09:oferta-9:a", NOW - timedelta(minutes=5), referencia="oferta-9"))
    _reconcile(repository, gateway)
    wire(repository, gateway)

    response = client.post("/pagos/cobros", json=_request(idempotency_key="asr09:oferta-9:b"))

    assert response.json()["estado"] == "aprobado"
    assert list(gateway.charges) == ["asr09:oferta-9:b"]


def test_gateway_lookup_maps_the_provider_result_and_an_unknown_key():
    class _Adapter:
        def lookup(self, idempotency_key):
            if idempotency_key == "known":
                return {"status": "approved"}
            request = httpx.Request("GET", f"https://pasarela.test/charges/{idempotency_key}")
            raise httpx.HTTPStatusError("not found", request=request, response=httpx.Response(404, request=request))

    gateway = PasarelaPagosGateway(_Adapter())

    assert gateway.lookup("known") == {"estado": EstadoCobro.APROBADO}
    assert gateway.lookup("unknown") is None


def test_postgres_lists_only_processing_payments_older_than_the_cutoff():
    repository = PostgresCobroRepository(_engine())
    repository.create_schema()
    repository.add(_pending("old", NOW - timedelta(minutes=5)))
    repository.add(_pending("recent", NOW - timedelta(seconds=30)))
    approved = _pending("approved", NOW - timedelta(minutes=5))
    approved.estado = EstadoCobro.APROBADO
    repository.add(approved)

    pending = repository.pendientes(NOW - THRESHOLD)

    assert [cobro.idempotency_key for cobro in pending] == ["old"]
