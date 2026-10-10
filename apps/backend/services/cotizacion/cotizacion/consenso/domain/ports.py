from typing import Protocol

from cotizacion.consenso.domain.models import OfertaCotizacion


class CotizacionRepository(Protocol):
    def save(self, oferta: OfertaCotizacion) -> None: ...

    def count(self) -> int: ...
