"""Adds cliente_id and radicado to avisos created before those columns existed.

Running it again leaves an already migrated table unchanged.
It is not part of service startup:

    python -m siniestros.avisos.migrate
"""

from solventa_common.db import build_engine
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from siniestros.config import settings


def migrate(engine: Engine) -> None:
    inspector = inspect(engine)
    if not inspector.has_table("avisos"):
        return
    present = {column["name"] for column in inspector.get_columns("avisos")}
    with engine.begin() as conn:
        if "cliente_id" not in present:
            conn.execute(text("ALTER TABLE avisos ADD COLUMN cliente_id VARCHAR(64) NOT NULL DEFAULT ''"))
        if "radicado" not in present:
            conn.execute(text("ALTER TABLE avisos ADD COLUMN radicado VARCHAR(16)"))
    if _radicado_es_unico(engine):
        return
    with engine.begin() as conn:
        conn.execute(text("CREATE UNIQUE INDEX ix_avisos_radicado ON avisos (radicado)"))


def _radicado_es_unico(engine: Engine) -> bool:
    inspector = inspect(engine)
    for index in inspector.get_indexes("avisos"):
        if index["unique"] and "radicado" in index["column_names"]:
            return True
    for constraint in inspector.get_unique_constraints("avisos"):
        if "radicado" in constraint["column_names"]:
            return True
    return False


def main() -> None:
    if not settings.database_url:
        raise SystemExit("La migración necesita DB_HOST y DB_NAME")
    migrate(build_engine(settings.database_url))


if __name__ == "__main__":
    main()
