"""Inicialización del almacén de identidad (clientes, consentimientos y operadores)."""

from solventa_common.db import build_engine
from sqlalchemy.engine import Engine

from identidad.config import settings
from identidad.kyc.adapters.account_repository import PostgresAccountRepository
from identidad.kyc.adapters.consentimiento_repository import PostgresConsentimientoRepository
from identidad.kyc.adapters.repository import PostgresClientRepository
from identidad.operadores.adapters.repository import PostgresOperatorRepository


def bootstrap(engine: Engine) -> None:
    PostgresClientRepository(engine).create_schema()
    PostgresAccountRepository(engine).create_schema()
    PostgresConsentimientoRepository(engine).create_schema()
    PostgresOperatorRepository(engine).create_schema()


def main() -> None:
    if not settings.database_url:
        raise SystemExit("El bootstrap necesita DB_HOST y DB_NAME")
    bootstrap(build_engine(settings.database_url))


if __name__ == "__main__":
    main()
