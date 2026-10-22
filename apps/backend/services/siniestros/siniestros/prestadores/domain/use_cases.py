import logging

from siniestros.prestadores.domain.eta import estimate_eta_min
from siniestros.prestadores.domain.models import ConsultaCercanos, PrestadorCercano
from siniestros.prestadores.domain.ports import CatalogSource, PrestadorRepository

logger = logging.getLogger(__name__)


class BuscarCercanosUseCase:
    def __init__(self, repository: PrestadorRepository) -> None:
        self.repository = repository

    def execute(self, consulta: ConsultaCercanos) -> list[PrestadorCercano]:
        return [
            PrestadorCercano(prestador=prestador, distancia_km=distancia, eta_min=estimate_eta_min(distancia))
            for prestador, distancia in self.repository.cercanos(consulta)
        ]


class SincronizarCatalogoUseCase:
    def __init__(self, repository: PrestadorRepository, sources: list[CatalogSource]) -> None:
        self.repository = repository
        self.sources = sources

    def execute(self) -> int:
        """Loads every source that answers. Rows are only upserted, so a failed source keeps what it loaded before."""
        cargados = 0
        for source in self.sources:
            try:
                prestadores = source.fetch()
            except Exception:
                logger.exception("No se pudo leer el catálogo de %s", type(source).__name__)
                continue
            self.repository.upsert(prestadores)
            cargados += len(prestadores)
        return cargados
