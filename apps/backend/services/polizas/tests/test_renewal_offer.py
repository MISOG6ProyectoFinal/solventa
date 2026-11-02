"""HU035: consultar la oferta de renovación no modifica la póliza vigente."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from polizas.ciclo_vida.adapters.repository import InMemoryPolicyRepository, PostgresPolicyRepository
from polizas.ciclo_vida.adapters.repository import policies as policies_table
from polizas.ciclo_vida.api import use_cases, wire
from polizas.ciclo_vida.domain.models import Coverage, Policy, PolicyStatus, Validity
from polizas.ciclo_vida.domain.use_cases import GetRenewalOfferUseCase, ListClientPoliciesUseCase
from polizas.main import app
from sqlalchemy import create_engine, func, select
from sqlalchemy.pool import StaticPool

client = TestClient(app)

HOY = date(2026, 10, 15)
CLIENTE = {"X-Cliente-Id": "cliente-1"}


class _Source:
    def get(self, resource_id: str) -> dict | None:
        return None


def _policy(**changes) -> Policy:
    data = {
        "id": "poliza-1",
        "numero": "POL-75885ABCDE",
        "estado": PolicyStatus.ACTIVE,
        "cotizacion_id": "cot-1",
        "cobro_id": "cobro-1",
        "producto_id": "viaje-internacional",
        "prima": Decimal("149940.00"),
        "coberturas": [Coverage(id="medicos", nombre="Gastos médicos en el exterior")],
        "vigencia": Validity(desde=date(2026, 10, 10), hasta=date(2026, 10, 24)),
        "canal": "mobile",
        "cliente_id": "cliente-1",
        "idempotency_key": "clave-1",
        "emitida_en": datetime(2026, 10, 10, tzinfo=UTC),
    }
    data.update(changes)
    return Policy(**data)


def _wire(policies: InMemoryPolicyRepository | PostgresPolicyRepository) -> None:
    wire(policies, _Source(), _Source())
    use_cases["renewal_offer"] = GetRenewalOfferUseCase(policies, today=lambda: HOY)
    use_cases["list"] = ListClientPoliciesUseCase(policies, today=lambda: HOY)


def _offer(poliza_id: str = "poliza-1", headers: dict | None = None):
    return client.get(f"/polizas/{poliza_id}/renovacion/oferta", headers=CLIENTE if headers is None else headers)


def test_devuelve_prima_vigencia_y_coberturas_sin_tocar_la_poliza():
    policies = InMemoryPolicyRepository()
    _wire(policies)
    policies.add(_policy())
    antes = policies.get_by_id("poliza-1").model_dump(mode="json")

    response = _offer()

    assert response.status_code == 200
    oferta = response.json()
    assert oferta["poliza_id"] == "poliza-1"
    assert oferta["numero_poliza"] == "POL-75885ABCDE"
    assert oferta["producto_id"] == "viaje-internacional"
    assert oferta["prima_actual"] == "149940.00"
    assert oferta["prima_propuesta"] == "149940.00"
    assert oferta["vigencia_actual"] == {"desde": "2026-10-10", "hasta": "2026-10-24"}
    assert oferta["vigencia_propuesta"] == {"desde": "2026-10-25", "hasta": "2026-11-08"}
    assert oferta["coberturas_propuestas"] == [{"id": "medicos", "nombre": "Gastos médicos en el exterior"}]
    assert policies.get_by_id("poliza-1").model_dump(mode="json") == antes
    assert len(policies.items) == 1


def test_el_caso_de_uso_conserva_prima_vigencia_estado_y_coberturas():
    policies = InMemoryPolicyRepository()
    original = _policy()
    policies.add(original)
    antes = original.model_dump(mode="json")
    caso = GetRenewalOfferUseCase(policies, today=lambda: HOY)

    oferta = caso.execute("poliza-1", "cliente-1")
    oferta.coberturas_propuestas[0].nombre = "Cambiada"
    oferta.coberturas_propuestas.append(Coverage(id="extra", nombre="Extra"))

    assert oferta.prima_propuesta == original.prima
    assert oferta.vigencia_propuesta == Validity(desde=date(2026, 10, 25), hasta=date(2026, 11, 8))
    assert policies.get_by_id("poliza-1").model_dump(mode="json") == antes
    assert original.coberturas[0].nombre == "Gastos médicos en el exterior"
    assert len(original.coberturas) == 1
    assert len(policies.items) == 1


def test_la_poliza_de_otro_cliente_responde_404_y_no_cambia():
    policies = InMemoryPolicyRepository()
    _wire(policies)
    policies.add(_policy())
    antes = policies.get_by_id("poliza-1").model_dump(mode="json")

    response = _offer(headers={"X-Cliente-Id": "cliente-2"})

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "poliza_no_encontrada"
    assert policies.get_by_id("poliza-1").model_dump(mode="json") == antes


def test_una_poliza_inexistente_responde_404():
    _wire(InMemoryPolicyRepository())

    response = _offer(poliza_id="no-existe")

    assert response.status_code == 404
    assert response.json()["detail"]["codigo"] == "poliza_no_encontrada"


def test_una_poliza_vencida_no_es_renovable_y_queda_igual():
    policies = InMemoryPolicyRepository()
    _wire(policies)
    policies.add(_policy(vigencia=Validity(desde=date(2026, 1, 1), hasta=date(2026, 10, 14))))
    antes = policies.get_by_id("poliza-1").model_dump(mode="json")

    response = _offer()

    assert response.status_code == 409
    assert response.json()["detail"]["codigo"] == "poliza_no_renovable"
    assert policies.get_by_id("poliza-1").model_dump(mode="json") == antes


def test_el_cliente_no_viaja_en_la_query():
    policies = InMemoryPolicyRepository()
    _wire(policies)
    policies.add(_policy())

    response = client.get("/polizas/poliza-1/renovacion/oferta", params={"cliente_id": "cliente-1"})

    assert response.status_code == 422
    assert policies.get_by_id("poliza-1").prima == Decimal("149940.00")


def test_el_listado_marca_renovable_sin_guardarlo():
    policies = InMemoryPolicyRepository()
    _wire(policies)
    policies.add(_policy())
    policies.add(
        _policy(
            id="poliza-vencida",
            numero="POL-VENCIDA01",
            cotizacion_id="cot-2",
            idempotency_key="clave-2",
            vigencia=Validity(desde=date(2026, 1, 1), hasta=date(2026, 10, 14)),
            emitida_en=datetime(2026, 1, 1, tzinfo=UTC),
        )
    )

    response = client.get("/polizas/clientes/cliente-1")

    assert response.status_code == 200
    por_id = {item["id"]: item["renovable"] for item in response.json()}
    assert por_id == {"poliza-vencida": False, "poliza-1": True}
    guardada = policies.get_by_id("poliza-1")
    assert "renovable" not in guardada.model_dump()


def test_un_periodo_bisiesto_conserva_su_duracion():
    policies = InMemoryPolicyRepository()
    policies.add(_policy(vigencia=Validity(desde=date(2024, 1, 1), hasta=date(2024, 12, 31))))
    oferta = GetRenewalOfferUseCase(policies, today=lambda: date(2024, 6, 1)).execute("poliza-1", "cliente-1")

    assert oferta.vigencia_propuesta == Validity(desde=date(2025, 1, 1), hasta=date(2026, 1, 1))
    assert (oferta.vigencia_propuesta.hasta - oferta.vigencia_propuesta.desde).days + 1 == 366


def test_postgres_consulta_por_id_sin_escribir():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    policies = PostgresPolicyRepository(engine)
    _wire(policies)
    policies.add(_policy())
    antes = policies.get_by_id("poliza-1").model_dump(mode="json")

    response = _offer()

    assert response.status_code == 200
    assert response.json()["prima_propuesta"] == "149940.00"
    assert policies.get_by_id("ausente") is None
    assert policies.get_by_id("poliza-1").model_dump(mode="json") == antes
    with engine.connect() as conn:
        assert conn.execute(select(func.count()).select_from(policies_table)).scalar_one() == 1
        prima = conn.execute(select(policies_table.c.prima)).scalar_one()
    assert prima == Decimal("149940.00")
    assert antes["vigencia"]["hasta"] == "2026-10-24"


def test_la_vigencia_de_un_dia_empieza_al_dia_siguiente():
    policies = InMemoryPolicyRepository()
    hoy = date(2026, 10, 15)
    policies.add(_policy(vigencia=Validity(desde=hoy, hasta=hoy)))
    oferta = GetRenewalOfferUseCase(policies, today=lambda: hoy).execute("poliza-1", "cliente-1")

    assert oferta.vigencia_propuesta.desde == hoy + timedelta(days=1)
    assert oferta.vigencia_propuesta.hasta == hoy + timedelta(days=1)
