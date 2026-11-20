from datetime import datetime
from typing import Protocol

from pagos.cobros.domain.models import Cobro, TipoReferencia


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

    def get_by_reference(self, tipo_referencia: TipoReferencia, referencia_id: str) -> Cobro | None: ...

    def claim_nuevo_intento(self, cobro_id: str, clave_actual: str, reemplazo: Cobro) -> Cobro | None: ...

    def pendientes(self, antes_de: datetime) -> list[Cobro]: ...


class PasarelaPort(Protocol):
    def charge(self, amount: float, currency: str, token: str, idempotency_key: str) -> dict: ...

    # None when the gateway never received a charge with this key.
    def lookup(self, idempotency_key: str) -> dict | None: ...
