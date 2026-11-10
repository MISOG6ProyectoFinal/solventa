"""Persistencia de pólizas. La clave de idempotencia y la cotización son únicas."""

import threading
from datetime import UTC, date, datetime, timedelta

from solventa_common.events import Event
from sqlalchemy import (
    JSON,
    Column,
    Date,
    DateTime,
    ForeignKey,
    MetaData,
    Numeric,
    String,
    Table,
    insert,
    or_,
    select,
    update,
)
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from polizas.ciclo_vida.domain.models import Beneficiary, Endorsement, Policy, PolicyStatus, Renewal, Validity
from polizas.ciclo_vida.domain.ports import DuplicatePolicy, DuplicateRenewal

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

renewals = Table(
    "renovaciones",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("poliza_id", String(36), nullable=False),
    Column("ciclo", String(255), nullable=False, unique=True),
    Column("cobro_id", String(64), nullable=False, unique=True),
    Column("vigencia_anterior_desde", Date, nullable=False),
    Column("vigencia_anterior_hasta", Date, nullable=False),
    Column("vigencia_nueva_desde", Date, nullable=False),
    Column("vigencia_nueva_hasta", Date, nullable=False),
    Column("prima_anterior", Numeric(18, 2), nullable=False),
    Column("prima_nueva", Numeric(18, 2), nullable=False),
    Column("aplicada_en", DateTime(timezone=True), nullable=False),
)

endorsements = Table(
    "endosos",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("poliza_id", String(36), ForeignKey("polizas.id", ondelete="CASCADE"), nullable=False),
    Column("tipo", String(60), nullable=False),
    Column("fecha_efectiva", Date, nullable=False),
    Column("prima_ajustada", Numeric(18, 2), nullable=True),
    Column("motivo", String(255), nullable=False),
    Column("usuario_id", String(64), nullable=True),
    Column("version_anterior", JSON, nullable=True),
    Column("version_nueva", JSON, nullable=True),
    Column("creado_en", DateTime(timezone=True), nullable=True),
)

outbox_events = Table(
    "outbox_eventos",
    metadata,
    Column("event_id", String(36), primary_key=True),
    Column("event_type", String(64), nullable=False),
    Column("source", String(32), nullable=False),
    Column("occurred_at", DateTime(timezone=True), nullable=False),
    Column("idempotency_key", String(255), nullable=False, unique=True),
    Column("payload", JSON, nullable=False),
    Column("estado", String(16), nullable=False),
    Column("publicado_en", DateTime(timezone=True), nullable=True),
)


beneficiaries = Table(
    "beneficiarios",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("poliza_id", String(36), ForeignKey("polizas.id", ondelete="CASCADE"), nullable=False),
    Column("nombre", String(120), nullable=False),
    Column("parentesco", String(60), nullable=False),
    Column("porcentaje", Numeric(5, 2), nullable=False),
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


def _renewal_values(renewal: Renewal) -> dict:
    return {
        "id": renewal.id,
        "poliza_id": renewal.poliza_id,
        "ciclo": renewal.ciclo,
        "cobro_id": renewal.cobro_id,
        "vigencia_anterior_desde": renewal.vigencia_anterior.desde,
        "vigencia_anterior_hasta": renewal.vigencia_anterior.hasta,
        "vigencia_nueva_desde": renewal.vigencia_nueva.desde,
        "vigencia_nueva_hasta": renewal.vigencia_nueva.hasta,
        "prima_anterior": renewal.prima_anterior,
        "prima_nueva": renewal.prima_nueva,
        "aplicada_en": renewal.aplicada_en,
    }


def _renewal(row) -> Renewal:
    return Renewal(
        id=row["id"],
        poliza_id=row["poliza_id"],
        ciclo=row["ciclo"],
        cobro_id=row["cobro_id"],
        vigencia_anterior=Validity(desde=row["vigencia_anterior_desde"], hasta=row["vigencia_anterior_hasta"]),
        vigencia_nueva=Validity(desde=row["vigencia_nueva_desde"], hasta=row["vigencia_nueva_hasta"]),
        prima_anterior=row["prima_anterior"],
        prima_nueva=row["prima_nueva"],
        aplicada_en=row["aplicada_en"],
    )


def _event_values(event: Event) -> dict:
    return {
        "event_id": event.event_id,
        "event_type": event.event_type,
        "source": event.source,
        "occurred_at": event.occurred_at,
        "idempotency_key": event.idempotency_key,
        "payload": event.payload,
        "estado": "pendiente",
        "publicado_en": None,
    }


def _event(row) -> Event:
    return Event(
        event_id=row["event_id"],
        event_type=row["event_type"],
        source=row["source"],
        occurred_at=row["occurred_at"],
        idempotency_key=row["idempotency_key"],
        payload=row["payload"],
    )


def _covers(renewal_row, policy_end: date, today: date) -> bool:
    start = renewal_row["vigencia_nueva_desde"]
    end = renewal_row["vigencia_nueva_hasta"]
    return start == policy_end + timedelta(days=1) and start <= today <= end


def _policy(row) -> Policy:
    return Policy(
        id=row["id"],
        numero=row["numero"],
        estado=PolicyStatus(row["estado"].lower()),
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

    def get_by_id(self, policy_id: str) -> Policy | None:
        return self._first(policies.c.id == policy_id)

    def list_by_client(self, cliente_id: str) -> list[Policy]:
        with self.engine.connect() as conn:
            rows = (
                conn.execute(
                    select(policies)
                    .where(
                        policies.c.cliente_id == cliente_id,
                        policies.c.estado.in_([PolicyStatus.ACTIVE.value, PolicyStatus.EXPIRED.value]),
                    )
                    .order_by(policies.c.emitida_en)
                )
                .mappings()
                .all()
            )
        return [_policy(row) for row in rows]

    def get(self, policy_id: str) -> Policy | None:
        return self._first(policies.c.id == policy_id)

    def list_beneficiaries(self, policy_id: str) -> list[Beneficiary]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(beneficiaries).where(beneficiaries.c.poliza_id == policy_id)).mappings().all()
        return [Beneficiary(nombre=r["nombre"], parentesco=r["parentesco"], porcentaje=r["porcentaje"]) for r in rows]

    def search(self, text: str | None, cliente_ids: list[str]) -> list[Policy]:
        conditions = []
        if text:
            conditions.append(policies.c.numero.ilike(f"%{text}%"))
        if cliente_ids:
            conditions.append(policies.c.cliente_id.in_(cliente_ids))
        query = select(policies).order_by(policies.c.emitida_en)
        if text or cliente_ids:
            query = query.where(or_(*conditions))
        with self.engine.connect() as conn:
            return [_policy(row) for row in conn.execute(query).mappings().all()]

    def list_recent(self, limit: int) -> list[Policy]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(policies).order_by(policies.c.emitida_en.desc()).limit(limit)).mappings().all()
        return [_policy(row) for row in rows]

    def expire_ended(self, today: date) -> int:
        self.activate_renewed_terms(today)
        with self.engine.begin() as conn:
            result = conn.execute(
                update(policies)
                .where(policies.c.estado == PolicyStatus.ACTIVE.value, policies.c.vigencia_hasta < today)
                .values(estado=PolicyStatus.EXPIRED.value)
            )
        return result.rowcount

    def activate_renewed_terms(self, today: date) -> int:
        with self.engine.begin() as conn:
            rows = (
                conn.execute(
                    select(
                        policies.c.id,
                        policies.c.vigencia_hasta,
                        renewals.c.vigencia_nueva_desde,
                        renewals.c.vigencia_nueva_hasta,
                        renewals.c.prima_nueva,
                    )
                    .join(renewals, renewals.c.poliza_id == policies.c.id)
                    .where(policies.c.estado == PolicyStatus.ACTIVE.value, policies.c.vigencia_hasta < today)
                )
                .mappings()
                .all()
            )
            changed = 0
            for row in rows:
                if not _covers(row, row["vigencia_hasta"], today):
                    continue
                conn.execute(
                    update(policies)
                    .where(policies.c.id == row["id"])
                    .values(
                        vigencia_desde=row["vigencia_nueva_desde"],
                        vigencia_hasta=row["vigencia_nueva_hasta"],
                        prima=row["prima_nueva"],
                    )
                )
                changed += 1
            return changed

    def get_renewal_by_payment(self, cobro_id: str) -> Renewal | None:
        return self._renewal_first(renewals.c.cobro_id == cobro_id)

    def get_renewal_by_cycle(self, ciclo: str) -> Renewal | None:
        return self._renewal_first(renewals.c.ciclo == ciclo)

    def list_renewals(self, poliza_ids: list[str]) -> list[Renewal]:
        if not poliza_ids:
            return []
        with self.engine.connect() as conn:
            rows = conn.execute(select(renewals).where(renewals.c.poliza_id.in_(poliza_ids))).mappings().all()
        return [_renewal(row) for row in rows]

    def save_renewal(self, renewal: Renewal, event: Event) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(insert(renewals).values(**_renewal_values(renewal)))
                conn.execute(insert(outbox_events).values(**_event_values(event)))
        except IntegrityError as exc:
            raise DuplicateRenewal(renewal.ciclo) from exc

    def save_endorsement(self, endorsement: Endorsement, event: Event) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                insert(endorsements).values(
                    **endorsement.model_dump(exclude={"creado_en"}), creado_en=endorsement.creado_en
                )
            )
            conn.execute(insert(outbox_events).values(**_event_values(event)))

    def list_endorsements(self, policy_id: str) -> list[Endorsement]:
        with self.engine.connect() as conn:
            rows = (
                conn.execute(
                    select(endorsements).where(endorsements.c.poliza_id == policy_id).order_by(endorsements.c.creado_en)
                )
                .mappings()
                .all()
            )
        return [
            Endorsement(
                **{
                    **row,
                    "usuario_id": row["usuario_id"] or "",
                    "version_anterior": row["version_anterior"] or {},
                    "version_nueva": row["version_nueva"] or {},
                    "creado_en": row["creado_en"] or datetime.now(UTC),
                }
            )
            for row in rows
        ]

    def pending_events(self) -> list[Event]:
        with self.engine.connect() as conn:
            rows = (
                conn.execute(
                    select(outbox_events)
                    .where(outbox_events.c.estado == "pendiente")
                    .order_by(outbox_events.c.occurred_at)
                )
                .mappings()
                .all()
            )
        return [_event(row) for row in rows]

    def mark_published(self, event_id: str) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                update(outbox_events)
                .where(outbox_events.c.event_id == event_id, outbox_events.c.estado == "pendiente")
                .values(estado="publicado", publicado_en=datetime.now(UTC))
            )

    def _renewal_first(self, condition) -> Renewal | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(renewals).where(condition)).mappings().first()
        return _renewal(row) if row else None

    def _first(self, condition) -> Policy | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(policies).where(condition)).mappings().first()
        return _policy(row) if row else None


class InMemoryPolicyRepository:
    def __init__(self) -> None:
        self.items: list[Policy] = []
        self.renewals: list[Renewal] = []
        self.events: list[tuple[Event, bool]] = []
        self.endorsements: list[Endorsement] = []
        self._lock = threading.RLock()

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

    def get_by_id(self, policy_id: str) -> Policy | None:
        with self._lock:
            return next((p for p in self.items if p.id == policy_id), None)

    def list_by_client(self, cliente_id: str) -> list[Policy]:
        with self._lock:
            found = [
                policy
                for policy in self.items
                if policy.cliente_id == cliente_id and policy.estado in (PolicyStatus.ACTIVE, PolicyStatus.EXPIRED)
            ]
            return sorted(found, key=lambda policy: policy.emitida_en)

    def get(self, policy_id: str) -> Policy | None:
        return self.get_by_id(policy_id)

    def list_beneficiaries(self, policy_id: str) -> list[Beneficiary]:
        with self._lock:
            if not any(p.id == policy_id for p in self.items):
                return []
            return []

    def search(self, text: str | None, cliente_ids: list[str]) -> list[Policy]:
        with self._lock:
            found = [
                p
                for p in self.items
                if not (text or cliente_ids)
                or (text and text.lower() in p.numero.lower())
                or p.cliente_id in cliente_ids
            ]
            return sorted(found, key=lambda policy: policy.emitida_en)

    def list_recent(self, limit: int) -> list[Policy]:
        with self._lock:
            return sorted(self.items, key=lambda policy: policy.emitida_en, reverse=True)[:limit]

    def expire_ended(self, today: date) -> int:
        self.activate_renewed_terms(today)
        with self._lock:
            ended = [p for p in self.items if p.estado is PolicyStatus.ACTIVE and p.vigencia.hasta < today]
            for policy in ended:
                policy.estado = PolicyStatus.EXPIRED
            return len(ended)

    def activate_renewed_terms(self, today: date) -> int:
        with self._lock:
            changed = 0
            for policy in self.items:
                if policy.estado is not PolicyStatus.ACTIVE or policy.vigencia.hasta >= today:
                    continue
                match = next(
                    (
                        renewal
                        for renewal in self.renewals
                        if renewal.poliza_id == policy.id
                        and renewal.vigencia_nueva.desde == policy.vigencia.hasta + timedelta(days=1)
                        and renewal.vigencia_nueva.desde <= today <= renewal.vigencia_nueva.hasta
                    ),
                    None,
                )
                if match is None:
                    continue
                policy.vigencia = match.vigencia_nueva.model_copy()
                policy.prima = match.prima_nueva
                changed += 1
            return changed

    def get_renewal_by_payment(self, cobro_id: str) -> Renewal | None:
        with self._lock:
            return next((renewal for renewal in self.renewals if renewal.cobro_id == cobro_id), None)

    def get_renewal_by_cycle(self, ciclo: str) -> Renewal | None:
        with self._lock:
            return next((renewal for renewal in self.renewals if renewal.ciclo == ciclo), None)

    def list_renewals(self, poliza_ids: list[str]) -> list[Renewal]:
        wanted = set(poliza_ids)
        with self._lock:
            return [renewal for renewal in self.renewals if renewal.poliza_id in wanted]

    def save_renewal(self, renewal: Renewal, event: Event) -> None:
        with self._lock:
            if any(item.ciclo == renewal.ciclo or item.cobro_id == renewal.cobro_id for item in self.renewals):
                raise DuplicateRenewal(renewal.ciclo)
            if any(stored.idempotency_key == event.idempotency_key for stored, _published in self.events):
                raise DuplicateRenewal(renewal.ciclo)
            self.renewals.append(renewal)
            self.events.append((event, False))

    def save_endorsement(self, endorsement: Endorsement, event: Event) -> None:
        with self._lock:
            self.endorsements.append(endorsement)
            self.events.append((event, False))

    def list_endorsements(self, policy_id: str) -> list[Endorsement]:
        with self._lock:
            return [e for e in self.endorsements if e.poliza_id == policy_id]

    def pending_events(self) -> list[Event]:
        with self._lock:
            return [event for event, published in self.events if not published]

    def mark_published(self, event_id: str) -> None:
        with self._lock:
            self.events = [
                (event, True) if event.event_id == event_id else (event, published) for event, published in self.events
            ]
