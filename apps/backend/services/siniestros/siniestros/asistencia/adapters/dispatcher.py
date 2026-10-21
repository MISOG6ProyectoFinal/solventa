import secrets
from collections.abc import Callable

from siniestros.asistencia.domain.models import Despacho, NuevaAsistencia

# Minutes of arrival by service. There is no provider catalog yet, so these are fixed.
ETA = {"grua": (25, 40), "ambulancia": (10, 20), "perito": (25, 40)}


def nuevo_numero() -> str:
    return f"AST-{1000 + secrets.randbelow(9000)}"


class PrototypeDispatcher:
    def __init__(self, numero_factory: Callable[[], str] = nuevo_numero) -> None:
        self.numero_factory = numero_factory

    def dispatch(self, solicitud: NuevaAsistencia) -> Despacho:
        eta_min, eta_max = ETA[solicitud.servicio]
        return Despacho(numero=self.numero_factory(), eta_min=eta_min, eta_max=eta_max)
