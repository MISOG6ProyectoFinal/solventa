from typing import Protocol

from siniestro_parametrico.domain.models import Liquidacion


class LiquidacionRepository(Protocol):
    def save(self, liquidacion: Liquidacion) -> None: ...
