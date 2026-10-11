"""Inicialización única del almacén de cotización.

Crea el schema y, si el catálogo no tiene productos, carga el dataset inicial.
No forma parte del arranque de las réplicas:

    python -m cotizacion.bootstrap
"""

from typing import Protocol

from solventa_common.db import build_engine
from sqlalchemy.engine import Engine

from cotizacion.catalogo.adapters.repository import PostgresCatalogoRepository
from cotizacion.catalogo.adapters.seed import seed_catalogo
from cotizacion.catalogo.domain.ports import CatalogoRepository
from cotizacion.config import settings
from cotizacion.consenso.adapters.cotizacion_repository import PostgresCotizacionRepository
from cotizacion.gobierno_socios.adapters.repository import PostgresSocioRepository


class _CatalogoBootstrap(CatalogoRepository, Protocol):
    def create_schema(self) -> None: ...


class _ConSchema(Protocol):
    def create_schema(self) -> None: ...


def inicializar_almacen(catalogo: _CatalogoBootstrap, *almacenes: _ConSchema) -> None:
    """Crea las tablas y siembra el catálogo vacío. Repetirlo no restaura filas borradas."""
    catalogo.create_schema()
    for almacen in almacenes:
        almacen.create_schema()
    if not catalogo.list_productos():
        seed_catalogo(catalogo)


def bootstrap(engine: Engine) -> None:
    inicializar_almacen(
        PostgresCatalogoRepository(engine),
        PostgresCotizacionRepository(engine),
        PostgresSocioRepository(engine),
    )


def main() -> None:
    if not settings.database_url:
        raise SystemExit("El bootstrap necesita DB_HOST y DB_NAME")
    bootstrap(build_engine(settings.database_url))


if __name__ == "__main__":
    main()
