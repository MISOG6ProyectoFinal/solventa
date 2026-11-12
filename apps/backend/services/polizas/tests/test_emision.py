"""Listado del cliente e idempotencia de la emisión móvil sobre el contrato de HU015."""

import threading

from fastapi.testclient import TestClient
from polizas.ciclo_vida.adapters.memory import InMemoryPolicyRepository
from polizas.ciclo_vida.adapters.repository import PostgresPolicyRepository
from polizas.ciclo_vida.adapters.repository import policies as policies_table
from polizas.ciclo_vida.api import router, wire
from polizas.ciclo_vida.domain.models import IssuePolicyRequest
from polizas.ciclo_vida.domain.use_cases import IssuePolicyUseCase
from polizas.main import app
from sqlalchemy import create_engine, func, select
from sqlalchemy.pool import StaticPool

client = TestClient(app)

QUOTE = {
    "id": "cot-m",
    "producto_id": "viaje-internacional",
    "prima": "149940.00",
    "coberturas": [
        {"id": "medicos", "nombre": "Gastos médicos en el exterior"},
        {"id": "equipaje", "nombre": "Pérdida de equipaje"},
    ],
    "vigencia_propuesta": {"desde": "2026-10-10", "hasta": "2026-10-24"},
    "vigente_hasta": "2099-01-01T23:59:59-05:00",
    "canal": "mobile",
    "cliente_id": "cliente-demo",
}
PAYMENT = {
    "id": "cobro-1",
    "cotizacion_id": "cot-m",
    "estado": "aprobado",
    "monto": "149940.00",
    "moneda": "COP",
    "creado_en": "2026-10-20T15:00:00+00:00",
}
REQUEST = {
    "cotizacion_id": "cot-m",
    "cobro_id": "cobro-1",
    "idempotency_key": "mobile:cliente-demo:cot-m:cobro-1",
    "canal": "mobile",
    "cliente_id": "cliente-demo",
}


class _Source:
    def __init__(self, *items: dict) -> None:
        self.items = {item["id"]: item for item in items}

    def get(self, resource_id: str) -> dict | None:
        return self.items.get(resource_id)


def _engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def _issue(**changes):
    return client.post("/polizas/emisiones", json=REQUEST | changes)


def test_la_emision_movil_persiste_vigencia_coberturas_y_cobro():
    policies = InMemoryPolicyRepository()
    wire(policies, _Source(QUOTE), _Source(PAYMENT))

    response = _issue()

    assert response.status_code == 201
    data = response.json()
    assert data["estado"] == "activa"
    assert data["numero"].startswith("POL-")
    assert data["cobro_id"] == "cobro-1"
    assert data["producto_id"] == "viaje-internacional"
    assert data["prima"] == "149940.00"
    assert data["vigencia"] == {"desde": "2026-10-10", "hasta": "2026-10-24"}
    assert data["coberturas"] == QUOTE["coberturas"]
    assert data["cliente_id"] == "cliente-demo"
    assert "pago_id" not in data
    assert "producto_nombre" not in data
    guardada = policies.get_by_quote("cot-m")
    assert guardada is not None
    assert guardada.id == data["id"]


def test_el_listado_devuelve_solo_las_polizas_del_cliente():
    otro = QUOTE | {"id": "cot-b", "cliente_id": "cliente-b"}
    pago_otro = PAYMENT | {"id": "cobro-2", "cotizacion_id": "cot-b"}
    wire(InMemoryPolicyRepository(), _Source(QUOTE, otro), _Source(PAYMENT, pago_otro))
    _issue()
    _issue(
        cotizacion_id="cot-b",
        cobro_id="cobro-2",
        idempotency_key="mobile:cliente-b:cot-b:cobro-2",
        cliente_id="cliente-b",
    )

    propias = client.get("/polizas/clientes/cliente-demo")
    ajenas = client.get("/polizas/clientes/cliente-b")
    ficha = client.get("/polizas/")

    assert propias.status_code == 200
    assert [item["cobro_id"] for item in propias.json()] == ["cobro-1"]
    assert propias.json()[0]["estado"] == "vencida"
    assert [item["cobro_id"] for item in ajenas.json()] == ["cobro-2"]
    assert ficha.status_code == 200
    assert ficha.json()["component"] == "Pólizas y Ciclo de Vida"


def test_postgres_lista_solo_al_cliente():
    engine = _engine()
    policies = PostgresPolicyRepository(engine)
    otro = QUOTE | {"id": "cot-b", "cliente_id": "cliente-b"}
    pago_otro = PAYMENT | {"id": "cobro-2", "cotizacion_id": "cot-b"}
    wire(policies, _Source(QUOTE, otro), _Source(PAYMENT, pago_otro))
    _issue()
    _issue(
        cotizacion_id="cot-b",
        cobro_id="cobro-2",
        idempotency_key="mobile:cliente-b:cot-b:cobro-2",
        cliente_id="cliente-b",
    )

    response = client.get("/polizas/clientes/cliente-demo")

    assert [item["cobro_id"] for item in response.json()] == ["cobro-1"]
    with engine.connect() as conn:
        assert conn.execute(select(func.count()).select_from(policies_table)).scalar_one() == 2
    assert policies.list_by_client("ausente") == []


def test_solicitudes_concurrentes_dejan_una_sola_poliza():
    policies = InMemoryPolicyRepository()
    caso = IssuePolicyUseCase(policies, _Source(QUOTE), _Source(PAYMENT))
    solicitud = IssuePolicyRequest.model_validate(REQUEST)
    resultados: list = []
    barrera = threading.Barrier(8)

    def correr() -> None:
        barrera.wait()
        policy, _created = caso.execute(solicitud)
        resultados.append(policy)

    hilos = [threading.Thread(target=correr) for _ in range(8)]
    for hilo in hilos:
        hilo.start()
    for hilo in hilos:
        hilo.join(3)

    assert len(resultados) == 8
    assert len({policy.id for policy in resultados}) == 1
    assert len(policies.items) == 1
    assert router.prefix == "/polizas"


def _poliza(numero: str, cliente_id: str, hasta: str = "2099-01-01", estado: str = "activa"):
    from polizas.ciclo_vida.domain.models import Coverage, Policy, PolicyStatus, Validity

    return Policy(
        numero=numero,
        estado=PolicyStatus(estado),
        cotizacion_id=f"cot-{numero}",
        cobro_id=f"cobro-{numero}",
        producto_id="viaje-internacional",
        prima="1000.00",
        coberturas=[Coverage(id="medicos", nombre="Gastos médicos")],
        vigencia=Validity(desde="2026-01-01", hasta=hasta),
        canal="mobile",
        cliente_id=cliente_id,
        idempotency_key=f"k-{numero}",
    )


def _repos():
    memoria = InMemoryPolicyRepository()
    postgres = PostgresPolicyRepository(_engine())
    postgres.create_schema()
    for repo in (memoria, postgres):
        repo.add(_poliza("POL-AAA111", "cli-1"))
        repo.add(_poliza("POL-BBB222", "cli-2", hasta="2020-01-01"))
        repo.add(_poliza("POL-CCC333", "cli-1", estado="cancelada"))
    return memoria, postgres


def test_la_consulta_busca_por_numero_parcial_o_por_cliente_y_sin_filtro_devuelve_todas():
    for repo in _repos():
        assert [p.numero for p in repo.search("bbb", [])] == ["POL-BBB222"]
        assert {p.numero for p in repo.search(None, ["cli-1"])} == {"POL-AAA111", "POL-CCC333"}
        assert {p.numero for p in repo.search("BBB", ["cli-1"])} == {"POL-AAA111", "POL-BBB222", "POL-CCC333"}
        assert len(repo.search(None, [])) == 3
        assert repo.search("no-existe", []) == []


def test_el_portal_consulta_por_numero_o_cliente_y_muestra_vencida_y_cancelada():
    memoria, _ = _repos()
    wire(memoria, _Source(), _Source())

    por_numero = client.get("/polizas", params={"q": "BBB"}).json()
    por_cliente = client.get("/polizas", params={"cliente_id": ["cli-1"]}).json()
    todas = client.get("/polizas").json()

    assert [(p["numero"], p["estado"]) for p in por_numero] == [("POL-BBB222", "vencida")]
    assert {(p["numero"], p["estado"]) for p in por_cliente} == {("POL-AAA111", "activa"), ("POL-CCC333", "cancelada")}
    assert len(todas) == 3


def test_el_detalle_devuelve_la_poliza_o_404():
    for repo in _repos():
        wire(repo, _Source(), _Source())
        existente = repo.search("AAA", [])[0]

        assert client.get(f"/polizas/{existente.id}").json()["numero"] == "POL-AAA111"
        respuesta = client.get("/polizas/no-existe")
        assert respuesta.status_code == 404
        assert respuesta.json()["detail"]["codigo"] == "poliza_no_encontrada"


def test_lee_polizas_sembradas_con_estado_capitalizado_y_coberturas_name():
    from datetime import UTC, date, datetime

    from sqlalchemy import insert

    engine = _engine()
    repo = PostgresPolicyRepository(engine)
    repo.create_schema()
    with engine.begin() as conn:
        conn.execute(
            insert(policies_table).values(
                id="POL-1",
                numero="SLV-2026-00901",
                estado="Vencida",
                cotizacion_id="c",
                cobro_id="p",
                producto_id="viaje-internacional",
                prima=270000,
                coberturas=[{"name": "Asistencia médica", "included": True}],
                vigencia_desde=date(2026, 4, 10),
                vigencia_hasta=date(2026, 4, 24),
                canal="web",
                socio_id="Aerolínea Andina",
                cliente_id="CLI-CC-79800123",
                idempotency_key="k",
                emitida_en=datetime(2026, 4, 10, 8, tzinfo=UTC),
            )
        )
    wire(repo, _Source(), _Source())

    data = client.get("/polizas").json()[0]

    assert data["estado"] == "vencida"
    assert data["coberturas"] == [{"id": "Asistencia médica", "nombre": "Asistencia médica"}]


def test_lista_los_beneficiarios_de_la_poliza_o_404():
    from polizas.ciclo_vida.adapters.repository import beneficiaries as beneficiaries_table
    from sqlalchemy import insert

    memoria, postgres = _repos()
    with postgres.engine.begin() as conn:
        poliza = postgres.search("AAA", [])[0]
        conn.execute(
            insert(beneficiaries_table).values(
                id="B1",
                poliza_id=poliza.id,
                nombre="Banco Aurora",
                parentesco="Acreedor",
                porcentaje=80,
            )
        )

    wire(postgres, _Source(), _Source())
    data = client.get(f"/polizas/{poliza.id}/beneficiarios").json()
    assert data == [{"nombre": "Banco Aurora", "parentesco": "Acreedor", "porcentaje": "80.00"}]
    assert client.get("/polizas/no-existe/beneficiarios").status_code == 404

    wire(memoria, _Source(), _Source())
    assert client.get(f"/polizas/{memoria.search('AAA', [])[0].id}/beneficiarios").json() == []
