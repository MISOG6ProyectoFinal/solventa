"""Pólizas en memoria, para pruebas y para correr sin base de datos."""

import threading
from datetime import date, timedelta

from solventa_common.events import Event

from polizas.ciclo_vida.domain.models import Beneficiary, Endorsement, Policy, PolicyStatus, Renewal
from polizas.ciclo_vida.domain.ports import DuplicatePolicy, DuplicateRenewal


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

    def cancel(self, policy_id: str, cause: str, cancelled_on: date, event: Event) -> bool:
        with self._lock:
            policy = next((p for p in self.items if p.id == policy_id), None)
            if policy is None or policy.estado is not PolicyStatus.ACTIVE:
                return False
            policy.estado = PolicyStatus.CANCELLED
            policy.causa_cancelacion = cause
            policy.fecha_cancelacion = cancelled_on
            self.events.append((event, False))
            return True

    def pending_events(self) -> list[Event]:
        with self._lock:
            return [event for event, published in self.events if not published]

    def mark_published(self, event_id: str) -> None:
        with self._lock:
            self.events = [
                (event, True) if event.event_id == event_id else (event, published) for event, published in self.events
            ]
