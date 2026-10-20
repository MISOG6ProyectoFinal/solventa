from typing import Protocol

from pagos.cobros.domain.models import Cobro


class CobroDuplicado(Exception):
    def __init__(self, idempotency_key: str) -> None:
        self.idempotency_key = idempotency_key
        super().__init__(idempotency_key)


class PasarelaNoDisponible(Exception):
    pass


class CobroRepository(Protocol):
    def add(self, cobro: Cobro) -> None: ...

    def update(self, cobro: Cobro) -> None: ...

    def get(self, payment_id: str) -> Cobro | None: ...

    def get_by_idempotency_key(self, idempotency_key: str) -> Cobro | None: ...

    def get_by_cotizacion_id(self, cotizacion_id: str) -> Cobro | None: ...

    def claim_nuevo_intento(self, cobro_id: str, clave_actual: str, reemplazo: Cobro) -> Cobro | None: ...


class PasarelaPort(Protocol):
    def charge(self, amount: float, currency: str, token: str, idempotency_key: str) -> dict: ...
