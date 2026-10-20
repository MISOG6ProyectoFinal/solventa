from decimal import Decimal
from typing import Any, Protocol

from cotizacion.senales.domain.models import ConsentimientoOpenFinance


class ProveedorPerfil(Protocol):
    fuente: str

    def consultar_riesgo(self, consentimiento: ConsentimientoOpenFinance) -> Decimal: ...


class CacheSenales(Protocol):
    def get(self, key: str) -> Any | None: ...

    def set(self, key: str, value: Any, ttl_s: int) -> None: ...
