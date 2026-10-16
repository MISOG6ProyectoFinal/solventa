"""Adds cliente_id to avisos created before a report was stored for a client.

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
    if "cliente_id" in present:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE avisos ADD COLUMN cliente_id VARCHAR(64) NOT NULL DEFAULT ''"))


def main() -> None:
    if not settings.database_url:
        raise SystemExit("La migración necesita DB_HOST y DB_NAME")
    migrate(build_engine(settings.database_url))


if __name__ == "__main__":
    main()
