"""Adds nombre and apellido to clientes created before registration stored a name.

Running it again leaves an already migrated table unchanged.
It is not part of service startup:

    python -m identidad.kyc.migrate
"""

from solventa_common.db import build_engine
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from identidad.config import settings


def migrate(engine: Engine) -> None:
    inspector = inspect(engine)
    if not inspector.has_table("clientes"):
        return
    present = {column["name"] for column in inspector.get_columns("clientes")}
    with engine.begin() as conn:
        if "nombre" not in present:
            conn.execute(text("ALTER TABLE clientes ADD COLUMN nombre VARCHAR(120) NOT NULL DEFAULT ''"))
        if "apellido" not in present:
            conn.execute(text("ALTER TABLE clientes ADD COLUMN apellido VARCHAR(120) NOT NULL DEFAULT ''"))


def main() -> None:
    if not settings.database_url:
        raise SystemExit("La migración necesita DB_HOST y DB_NAME")
    migrate(build_engine(settings.database_url))


if __name__ == "__main__":
    main()
