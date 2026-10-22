"""Carga el catálogo de prestadores en Postgres: python -m siniestros.prestadores.sync"""

import logging

from solventa_common.db import build_engine

from siniestros.config import settings
from siniestros.prestadores.adapters.overpass_catalog import OverpassCatalog
from siniestros.prestadores.adapters.postgis import PostgisPrestadorRepository
from siniestros.prestadores.adapters.seed_catalog import SeedCatalog
from siniestros.prestadores.domain.use_cases import SincronizarCatalogoUseCase


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    repository = PostgisPrestadorRepository(build_engine(settings.database_url))
    repository.create_schema()
    # The seed goes first so a slow Overpass never delays the allies.
    cargados = SincronizarCatalogoUseCase(repository, [SeedCatalog(), OverpassCatalog()]).execute()
    logging.getLogger(__name__).info("Catálogo sincronizado: %d prestadores", cargados)


if __name__ == "__main__":
    main()
