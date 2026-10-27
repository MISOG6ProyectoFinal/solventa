from typing import Protocol

from siniestros.prestadores.domain.models import ConsultaCercanos, Prestador


class PrestadorRepository(Protocol):
    def upsert(self, prestadores: list[Prestador]) -> None: ...

    def cercanos(self, consulta: ConsultaCercanos) -> list[tuple[Prestador, float]]:
        """Providers inside the radius with their distance in km, nearest first, at most MAX_RESULTADOS."""
        ...


class CatalogSource(Protocol):
    def fetch(self) -> list[Prestador]: ...
