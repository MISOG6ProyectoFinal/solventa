"""Persistencia de pólizas. La clave de idempotencia y la cotización son únicas."""

import threading

from sqlalchemy import JSON, Column, Date, DateTime, MetaData, Numeric, String, Table, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from polizas.ciclo_vida.domain.models import Policy, PolicyStatus, Validity
from polizas.ciclo_vida.domain.ports import DuplicatePolicy

metadata = MetaData()

policies = Table(
    "polizas",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("numero", String(20), nullable=False, unique=True),
    Column("estado", String(16), nullable=False),
    Column("cotizacion_id", String(64), nullable=False, unique=True),
    Column("cobro_id", String(64), nullable=False),
    Column("producto_id", String(64), nullable=False),
    Column("prima", Numeric(18, 2), nullable=False),
    Column("coberturas", JSON, nullable=False),
    Column("vigencia_desde", Date, nullable=False),
    Column("vigencia_hasta", Date, nullable=False),
    Column("canal", String(16), nullable=False),
    Column("socio_id", String(36), nullable=True),
    Column("cliente_id", String(64), nullable=True),
    Column("idempotency_key", String(255), nullable=False, unique=True),
    Column("emitida_en", DateTime(timezone=True), nullable=False),
)


def _row_values(policy: Policy) -> dict:
    values = policy.model_dump(mode="json", exclude={"vigencia", "emitida_en", "prima"})
    return {
        **values,
        "prima": policy.prima,
        "vigencia_desde": policy.vigencia.desde,
        "vigencia_hasta": policy.vigencia.hasta,
        "emitida_en": policy.emitida_en,
    }


def _policy(row) -> Policy:
    return Policy(
        id=row["id"],
        numero=row["numero"],
        estado=PolicyStatus(row["estado"]),
        cotizacion_id=row["cotizacion_id"],
        cobro_id=row["cobro_id"],
        producto_id=row["producto_id"],
        prima=row["prima"],
        coberturas=row["coberturas"],
        vigencia=Validity(desde=row["vigencia_desde"], hasta=row["vigencia_hasta"]),
        canal=row["canal"],
        socio_id=row["socio_id"],
        cliente_id=row["cliente_id"],
        idempotency_key=row["idempotency_key"],
        emitida_en=row["emitida_en"],
    )


class PostgresPolicyRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def add(self, policy: Policy) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(insert(policies).values(**_row_values(policy)))
        except IntegrityError as exc:
            raise DuplicatePolicy(policy.cotizacion_id) from exc

    def get_by_idempotency_key(self, idempotency_key: str) -> Policy | None:
        return self._first(policies.c.idempotency_key == idempotency_key)

    def get_by_quote(self, quote_id: str) -> Policy | None:
        return self._first(policies.c.cotizacion_id == quote_id)

    def list_by_client(self, cliente_id: str) -> list[Policy]:
        with self.engine.connect() as conn:
            rows = (
                conn.execute(
                    select(policies)
                    .where(policies.c.cliente_id == cliente_id, policies.c.estado == PolicyStatus.ACTIVE.value)
                    .order_by(policies.c.emitida_en)
                )
                .mappings()
                .all()
            )
        return [_policy(row) for row in rows]

    def _first(self, condition) -> Policy | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(policies).where(condition)).mappings().first()
        return _policy(row) if row else None


class InMemoryPolicyRepository:
    def __init__(self) -> None:
        self.items: list[Policy] = []
        self._lock = threading.Lock()

    def add(self, policy: Policy) -> None:
        with self._lock:
            if any(
                p.idempotency_key == policy.idempotency_key or p.cotizacion_id == policy.cotizacion_id
                for p in self.items
            ):
                raise DuplicatePolicy(policy.cotizacion_id)
            self.items.append(policy)

    def get_by_idempotency_key(self, idempotency_key: str) -> Policy | None:
        with self._lock:
            return next((p for p in self.items if p.idempotency_key == idempotency_key), None)

    def get_by_quote(self, quote_id: str) -> Policy | None:
        with self._lock:
            return next((p for p in self.items if p.cotizacion_id == quote_id), None)

    def list_by_client(self, cliente_id: str) -> list[Policy]:
        with self._lock:
            found = [
                policy
                for policy in self.items
                if policy.cliente_id == cliente_id and policy.estado is PolicyStatus.ACTIVE
            ]
            return sorted(found, key=lambda policy: policy.emitida_en)
