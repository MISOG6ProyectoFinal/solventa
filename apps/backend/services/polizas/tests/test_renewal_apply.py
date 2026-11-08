"""HU037: la renovación se aplica solo con el cobro aprobado de ese ciclo, una sola vez."""

import threading
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from polizas.ciclo_vida.adapters.repository import (
    InMemoryPolicyRepository,
    PostgresPolicyRepository,
    outbox_events,
    renewals,
)
from polizas.ciclo_vida.adapters.repository import policies as policies_table
from polizas.ciclo_vida.api import use_cases, wire
from polizas.ciclo_vida.domain.models import Coverage, Policy, PolicyStatus, Validity
from polizas.ciclo_vida.domain.ports import DuplicateRenewal, PolicyRepository
from polizas.ciclo_vida.domain.use_cases import (
    ApplyRenewalUseCase,
    GetPolicyUseCase,
    GetRenewalOfferUseCase,
    ListClientPoliciesUseCase,
)
from polizas.main import app
from solventa_common.events import Event, InMemoryEventPublisher
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.pool import StaticPool

client = TestClient(app)

HOY = date(2026, 11, 8)
CICLO = "poliza-1:2027-01-01:2027-12-31"
CLIENTE = {"X-Cliente-Id": "cliente-1"}
VIGENCIA = Validity(desde=date(2026, 1, 1), hasta=date(2026, 12, 31))
NUEVA = Validity(desde=date(2027, 1, 1), hasta=date(2027, 12, 31))


class _Source:
    def __init__(self, *items: dict) -> None:
        self.items = {item["id"]: item for item in items if item.get("id")}

    def get(self, resource_id: str) -> dict | None:
        return self.items.get(resource_id)


class _Quotes:
    def get(self, resource_id: str) -> None:
        return None


class _FlakyPublisher:
    def __init__(self) -> None:
        self.events: list[Event] = []
        self.failures = 1

    def publish(self, item: Event) -> None:
        if self.failures:
            self.failures -= 1
            raise RuntimeError("sns")
        self.events.append(item)


def _policy(**changes) -> Policy:
    data = {
        "id": "poliza-1",
        "numero": "POL-75885ABCDE",
        "estado": PolicyStatus.ACTIVE,
        "cotizacion_id": "cot-1",
        "cobro_id": "cobro-emision",
        "producto_id": "viaje-internacional",
        "prima": Decimal("100.00"),
        "coberturas": [Coverage(id="medicos", nombre="Gastos médicos en el exterior")],
        "vigencia": VIGENCIA,
        "canal": "mobile",
        "cliente_id": "cliente-1",
        "idempotency_key": "clave-1",
        "emitida_en": datetime(2026, 1, 1, tzinfo=UTC),
    }
    data.update(changes)
    return Policy(**data)


def _payment(**changes) -> dict:
    data = {
        "id": "cobro-renovacion",
        "estado": "aprobado",
        "tipo_referencia": "renovacion",
        "referencia_id": CICLO,
        "cotizacion_id": None,
        "cliente_id": "cliente-1",
        "monto": "100.00",
        "moneda": "COP",
    }
    data.update(changes)
    return data


def _engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def _prepare(
    policies: PolicyRepository,
    payment: dict | None,
    hoy: date = HOY,
    publisher=None,
) -> InMemoryEventPublisher | _FlakyPublisher:
    bus = publisher or InMemoryEventPublisher()
    payments = _Source(payment) if payment is not None else _Source()
    wire(policies, _Quotes(), payments, bus)
    use_cases["apply"] = ApplyRenewalUseCase(policies, payments, bus, today=lambda: hoy)
    use_cases["list"] = ListClientPoliciesUseCase(policies, today=lambda: hoy)
    use_cases["renewal_offer"] = GetRenewalOfferUseCase(policies, today=lambda: hoy)
    use_cases["get"] = GetPolicyUseCase(policies, today=lambda: hoy)
    return bus


def _aplicar(cobro_id: str = "cobro-renovacion", body: dict | None = None, headers: dict | None = None):
    payload = {"cobro_id": cobro_id}
    if body:
        payload.update(body)
    return client.post("/polizas/poliza-1/renovaciones", json=payload, headers=CLIENTE if headers is None else headers)


def test_aplica_la_renovacion_conserva_la_cobertura_actual_y_publica_el_evento():
    policies = InMemoryPolicyRepository()
    policies.add(_policy())
    antes = policies.get_by_id("poliza-1").model_dump(mode="json")
    bus = _prepare(policies, _payment())

    response = _aplicar(
        body={
            "monto": "1",
            "vigencia_nueva": {"desde": "1999-01-01", "hasta": "1999-01-02"},
            "cliente_id": "otro",
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["estado"] == "aplicada"
    assert data["poliza_id"] == "poliza-1"
    assert data["numero_poliza"] == "POL-75885ABCDE"
    assert data["cobro_id"] == "cobro-renovacion"
    assert data["vigencia_anterior"] == {"desde": "2026-01-01", "hasta": "2026-12-31"}
    assert data["vigencia_nueva"] == {"desde": "2027-01-01", "hasta": "2027-12-31"}
    assert data["coberturas"] == [{"id": "medicos", "nombre": "Gastos médicos en el exterior"}]
    assert data["vigencia_nueva"] != {"desde": "1999-01-01", "hasta": "1999-01-02"}

    guardada = policies.get_by_id("poliza-1")
    assert guardada is not None
    assert guardada.model_dump(mode="json") == antes
    renovacion = policies.get_renewal_by_payment("cobro-renovacion")
    assert renovacion is not None
    assert renovacion.ciclo == CICLO
    assert renovacion.vigencia_nueva == NUEVA
    assert policies.get_renewal_by_cycle(CICLO).id == renovacion.id

    listado = client.get("/polizas/clientes/cliente-1")
    assert listado.status_code == 200
    ficha = listado.json()[0]
    assert ficha["renovable"] is False
    assert ficha["vigencia"] == {"desde": "2026-01-01", "hasta": "2026-12-31"}
    assert ficha["estado"] == "activa"
    assert ficha["renovacion"]["estado"] == "aplicada"
    assert ficha["renovacion"]["cobro_id"] == "cobro-renovacion"
    assert ficha["renovacion"]["vigencia_nueva"] == {"desde": "2027-01-01", "hasta": "2027-12-31"}
    assert client.get("/polizas/poliza-1/renovacion/oferta", headers=CLIENTE).status_code == 409

    assert len(bus.events) == 1
    event = bus.events[0]
    assert event.event_type == "poliza.renovada"
    assert event.source == "polizas"
    assert event.idempotency_key == f"poliza.renovada:{CICLO}"
    assert event.payload == {
        "poliza_id": "poliza-1",
        "cobro_id": "cobro-renovacion",
        "ciclo_renovacion": CICLO,
        "vigencia_anterior": {"desde": "2026-01-01", "hasta": "2026-12-31"},
        "vigencia_nueva": {"desde": "2027-01-01", "hasta": "2027-12-31"},
    }
    assert policies.pending_events() == []


def test_postgres_persiste_la_renovacion_y_el_evento_en_la_misma_operacion():
    policies = PostgresPolicyRepository(_engine())
    bus = _prepare(policies, _payment())
    policies.add(_policy())

    response = _aplicar()

    assert response.status_code == 201
    with policies.engine.connect() as conn:
        assert conn.execute(select(func.count()).select_from(renewals)).scalar_one() == 1
        assert conn.execute(select(func.count()).select_from(outbox_events)).scalar_one() == 1
        vigente = conn.execute(select(policies_table.c.vigencia_hasta)).scalar_one()
    assert vigente == date(2026, 12, 31)
    assert policies.get_by_id("poliza-1").cobro_id == "cobro-emision"
    assert len(bus.events) == 1
    assert policies.pending_events() == []
    assert _aplicar().status_code == 200
    with policies.engine.connect() as conn:
        assert conn.execute(select(func.count()).select_from(renewals)).scalar_one() == 1
        assert conn.execute(select(func.count()).select_from(outbox_events)).scalar_one() == 1


def test_postgres_mantiene_la_cobertura_y_luego_toma_la_vigencia_renovada():
    policies = PostgresPolicyRepository(_engine())
    _prepare(policies, _payment())
    policies.add(_policy())
    assert _aplicar().status_code == 201

    vigente = client.get("/polizas/clientes/cliente-1").json()[0]
    use_cases["list"] = ListClientPoliciesUseCase(policies, today=lambda: date(2027, 6, 1))
    avanzada = client.get("/polizas/clientes/cliente-1").json()[0]

    assert vigente["vigencia"] == {"desde": "2026-01-01", "hasta": "2026-12-31"}
    assert vigente["renovable"] is False
    assert avanzada["vigencia"] == {"desde": "2027-01-01", "hasta": "2027-12-31"}
    assert avanzada["estado"] == "activa"
    assert avanzada["renovacion"] is None
    assert policies.get_by_id("poliza-1").cotizacion_id == "cot-1"


@pytest.mark.parametrize(
    ("payment", "codigo"),
    [
        (_payment(estado="rechazado"), "pago_no_aprobado"),
        (_payment(estado="procesando"), "pago_no_aprobado"),
        (None, "pago_no_aprobado"),
        (_payment(referencia_id="poliza-2:2027-01-01:2027-12-31"), "pago_no_corresponde"),
        (_payment(cliente_id="cliente-2"), "pago_no_corresponde"),
        (_payment(referencia_id="poliza-1:2028-01-01:2028-12-31"), "pago_no_corresponde"),
        (
            _payment(tipo_referencia="cotizacion", referencia_id="cot-1", cotizacion_id="cot-1"),
            "pago_no_corresponde",
        ),
        (_payment(monto="100.01"), "pago_no_corresponde"),
        (_payment(moneda="USD"), "pago_no_corresponde"),
    ],
)
def test_un_pago_incorrecto_no_aplica_ni_escribe(payment, codigo):
    policies = InMemoryPolicyRepository()
    policies.add(_policy())
    antes = policies.get_by_id("poliza-1").model_dump(mode="json")
    bus = _prepare(policies, payment)

    response = _aplicar()

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == codigo
    assert policies.get_by_id("poliza-1").model_dump(mode="json") == antes
    assert policies.get_renewal_by_payment("cobro-renovacion") is None
    assert policies.renewals == []
    assert bus.events == []
    assert policies.pending_events() == []


def test_la_poliza_de_otro_cliente_no_se_renueva():
    policies = InMemoryPolicyRepository()
    policies.add(_policy())
    antes = policies.get_by_id("poliza-1").model_dump(mode="json")
    bus = _prepare(policies, _payment())

    response = _aplicar(headers={"X-Cliente-Id": "cliente-2"})

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "poliza_no_encontrada"
    assert policies.get_by_id("poliza-1").model_dump(mode="json") == antes
    assert bus.events == []


def test_una_poliza_vencida_o_cancelada_no_se_renueva():
    for estado, vigencia in (
        (PolicyStatus.ACTIVE, Validity(desde=date(2026, 1, 1), hasta=date(2026, 11, 7))),
        (PolicyStatus.CANCELLED, VIGENCIA),
    ):
        policies = InMemoryPolicyRepository()
        policies.add(_policy(estado=estado, vigencia=vigencia))
        antes = policies.get_by_id("poliza-1").model_dump(mode="json")
        bus = _prepare(policies, _payment())

        response = _aplicar()

        assert response.status_code == 409
        assert response.json()["detail"]["codigo"] == "poliza_no_renovable"
        assert policies.get_by_id("poliza-1").model_dump(mode="json") == antes
        assert bus.events == []


def test_repetir_el_mismo_cobro_no_duplica_renovacion_ni_evento():
    policies = InMemoryPolicyRepository()
    policies.add(_policy())
    bus = _prepare(policies, _payment())

    primero = _aplicar()
    segundo = _aplicar()

    assert primero.status_code == 201
    assert segundo.status_code == 200
    assert segundo.json() == primero.json()
    assert len(policies.renewals) == 1
    assert len(bus.events) == 1
    assert len(policies.events) == 1


def test_otro_pago_del_mismo_ciclo_no_extiende_la_cobertura():
    policies = InMemoryPolicyRepository()
    policies.add(_policy())
    bus = _prepare(policies, _payment(), publisher=InMemoryEventPublisher())
    _aplicar()
    policies_payments = _Source(_payment(), _payment(id="cobro-2"))
    use_cases["apply"] = ApplyRenewalUseCase(policies, policies_payments, bus, today=lambda: HOY)

    response = _aplicar("cobro-2")

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "renovacion_ya_aplicada"
    assert "vuelvas a pagar" not in response.json()["detail"]["mensaje"]
    assert len(policies.renewals) == 1
    assert len(bus.events) == 1
    assert policies.get_by_id("poliza-1").vigencia == VIGENCIA


def test_el_reintento_reconoce_el_ciclo_aunque_la_vigencia_ya_haya_avanzado():
    policies = InMemoryPolicyRepository()
    policies.add(_policy())
    bus = _prepare(policies, _payment())
    assert _aplicar().status_code == 201
    use_cases["list"] = ListClientPoliciesUseCase(policies, today=lambda: date(2027, 6, 1))
    use_cases["renewal_offer"] = GetRenewalOfferUseCase(policies, today=lambda: date(2027, 6, 1))

    listado = client.get("/polizas/clientes/cliente-1").json()[0]
    repetido = _aplicar()
    oferta = client.get("/polizas/poliza-1/renovacion/oferta", headers=CLIENTE)

    assert listado["vigencia"] == {"desde": "2027-01-01", "hasta": "2027-12-31"}
    assert listado["estado"] == "activa"
    assert listado["renovacion"] is None
    assert listado["renovable"] is True
    assert repetido.status_code == 200
    assert repetido.json()["vigencia_nueva"] == {"desde": "2027-01-01", "hasta": "2027-12-31"}
    assert len(policies.renewals) == 1
    assert len(bus.events) == 1
    assert oferta.status_code == 200
    assert oferta.json()["vigencia_propuesta"]["desde"] == "2028-01-01"


def test_dos_solicitudes_concurrentes_dejan_una_sola_renovacion():
    policies = InMemoryPolicyRepository()
    policies.add(_policy())
    bus = _prepare(policies, _payment())
    caso = use_cases["apply"]
    resultados: list[tuple] = []
    errores: list[BaseException] = []
    barrera = threading.Barrier(8)

    def correr() -> None:
        barrera.wait()
        try:
            resultados.append(caso.execute("poliza-1", "cliente-1", "cobro-renovacion"))
        except BaseException as exc:  # pragma: no cover - el assert de abajo muestra el fallo
            errores.append(exc)

    hilos = [threading.Thread(target=correr) for _ in range(8)]
    for hilo in hilos:
        hilo.start()
    for hilo in hilos:
        hilo.join(3)

    assert errores == []
    assert len(resultados) == 8
    assert len(policies.renewals) == 1
    assert len({item[0].vigencia_nueva.desde for item in resultados}) == 1
    assert len(bus.events) == 1
    assert len(policies.events) == 1


def test_la_restriccion_sql_rechaza_otro_registro_del_mismo_ciclo():
    policies = PostgresPolicyRepository(_engine())
    _prepare(policies, _payment())
    policies.add(_policy())
    assert _aplicar().status_code == 201
    guardada = policies.get_renewal_by_cycle(CICLO)
    assert guardada is not None
    repetida = guardada.model_copy(update={"id": str(uuid4()), "cobro_id": "cobro-2"})
    otro_evento = Event(
        event_type="poliza.renovada",
        source="polizas",
        idempotency_key="poliza.renovada:otro-intento",
        payload={"poliza_id": "poliza-1"},
    )

    with pytest.raises(DuplicateRenewal):
        policies.save_renewal(repetida, otro_evento)

    with policies.engine.connect() as conn:
        assert conn.execute(select(func.count()).select_from(renewals)).scalar_one() == 1
        assert conn.execute(select(func.count()).select_from(outbox_events)).scalar_one() == 1


def test_un_fallo_al_guardar_el_evento_revierte_la_renovacion():
    engine = _engine()
    policies = PostgresPolicyRepository(engine)
    bus = _prepare(policies, _payment())
    policies.add(_policy())
    antes = policies.get_by_id("poliza-1").model_dump(mode="json")

    def fallar(_conn, _cursor, statement, _parameters, _context, _executemany) -> None:
        if "outbox_eventos" in statement:
            raise RuntimeError("fallo de outbox")

    event.listen(engine, "before_cursor_execute", fallar)
    try:
        with pytest.raises(RuntimeError, match="outbox"):
            use_cases["apply"].execute("poliza-1", "cliente-1", "cobro-renovacion")
    finally:
        event.remove(engine, "before_cursor_execute", fallar)

    assert policies.get_by_id("poliza-1").model_dump(mode="json") == antes
    assert policies.get_renewal_by_payment("cobro-renovacion") is None
    assert policies.pending_events() == []
    assert bus.events == []
    with engine.connect() as conn:
        assert conn.execute(select(func.count()).select_from(renewals)).scalar_one() == 0
        assert conn.execute(select(func.count()).select_from(outbox_events)).scalar_one() == 0


def test_si_la_publicacion_falla_el_evento_queda_pendiente_y_el_reintento_no_renueva_de_nuevo():
    policies = InMemoryPolicyRepository()
    policies.add(_policy())
    bus = _FlakyPublisher()
    _prepare(policies, _payment(), publisher=bus)

    response = _aplicar()
    pendiente = policies.pending_events()

    assert response.status_code == 201
    assert len(policies.renewals) == 1
    assert bus.events == []
    assert len(pendiente) == 1
    assert pendiente[0].idempotency_key == f"poliza.renovada:{CICLO}"

    publicados = use_cases["apply"].publish_pending()
    otra = use_cases["apply"].publish_pending()
    repetido = _aplicar()

    assert publicados == 1
    assert otra == 0
    assert repetido.status_code == 200
    assert len(policies.renewals) == 1
    assert len(bus.events) == 1
    assert bus.events[0].event_id == pendiente[0].event_id
    assert policies.pending_events() == []
    assert policies.get_by_id("poliza-1").vigencia == VIGENCIA
