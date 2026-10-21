from typing import Protocol

from polizas.ciclo_vida.domain.models import Policy


class QuoteNotFound(LookupError):
    pass


class QuoteExpired(ValueError):
    pass


class PaymentNotApproved(ValueError):
    pass


class IdempotencyKeyReused(ValueError):
    pass


class DuplicatePolicy(Exception):
    pass


class QuoteSource(Protocol):
    def get(self, quote_id: str) -> dict | None: ...


class PaymentSource(Protocol):
    def get(self, payment_id: str) -> dict | None: ...


class PolicyRepository(Protocol):
    def add(self, policy: Policy) -> None: ...

    def get_by_idempotency_key(self, idempotency_key: str) -> Policy | None: ...

    def get_by_quote(self, quote_id: str) -> Policy | None: ...
