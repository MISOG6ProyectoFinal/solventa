from typing import Protocol

from siniestros.parametrico.domain.models import Liquidacion


class LiquidacionRepository(Protocol):
    def save(self, liquidacion: Liquidacion) -> None: ...
