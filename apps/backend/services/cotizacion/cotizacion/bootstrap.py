"""Inicialización única del almacén de cotización.

Crea el schema y carga el dataset inicial del catálogo y de las reglas de rating si están vacíos.
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
from cotizacion.gobierno_socios.adapters.configuracion_repository import PostgresConfiguracionRepository
from cotizacion.gobierno_socios.adapters.quota_repository import PostgresQuotaCounter
from cotizacion.gobierno_socios.adapters.repository import PostgresSocioRepository
from cotizacion.rating.adapters.repository import PostgresRulesRepository
from cotizacion.rating.adapters.seed import seed_rules
from cotizacion.rating.domain.ports import RulesRepository


class _CatalogoBootstrap(CatalogoRepository, Protocol):
    def create_schema(self) -> None: ...


class _RulesBootstrap(RulesRepository, Protocol):
    def create_schema(self) -> None: ...


class _ConSchema(Protocol):
    def create_schema(self) -> None: ...


def inicializar_almacen(catalogo: _CatalogoBootstrap, rules: _RulesBootstrap, *almacenes: _ConSchema) -> None:
    """Crea las tablas y siembra lo que esté vacío. Repetirlo no restaura filas borradas."""
    catalogo.create_schema()
    rules.create_schema()
    for almacen in almacenes:
        almacen.create_schema()
    if not catalogo.list_productos():
        seed_catalogo(catalogo)
    if not rules.versions():
        seed_rules(rules)


def bootstrap(engine: Engine) -> None:
    inicializar_almacen(
        PostgresCatalogoRepository(engine),
        PostgresRulesRepository(engine),
        PostgresCotizacionRepository(engine),
        PostgresSocioRepository(engine),
        PostgresConfiguracionRepository(engine),
        PostgresQuotaCounter(engine),
    )


def main() -> None:
    if not settings.database_url:
        raise SystemExit("El bootstrap necesita DB_HOST y DB_NAME")
    bootstrap(build_engine(settings.database_url))


if __name__ == "__main__":
    main()
