"""Votación dos de tres, acotada en tiempo (sección 9.5.1, patrón 2).

No es un consenso bizantino: protege contra un bug puntual o una corrupción de
memoria en una réplica. Se compara la prima redondeada al centavo.
"""

from collections import Counter
from collections.abc import Hashable, Sequence
from typing import TypeVar

K = TypeVar("K", bound=Hashable)


class SinConsenso(RuntimeError):
    def __init__(self, votos: dict) -> None:
        super().__init__(f"Sin mayoría: {votos}")
        self.votos = votos


def votar(resultados: Sequence[K], quorum: int) -> K:
    if not resultados:
        raise SinConsenso({})
    conteo = Counter(resultados)
    ganador, votos = conteo.most_common(1)[0]
    if votos < quorum:
        raise SinConsenso(dict(conteo))
    return ganador
