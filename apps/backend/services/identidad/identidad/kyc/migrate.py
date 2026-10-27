"""Brings clientes created before the current registration flow up to date.

Adds the missing columns, copies the legacy correo into email, makes email and
numero_documento unique and lets correo be empty because new clients no longer write it.
Credentials move from clientes to cuentas. The old columns stay in place and unused.

Running it again leaves an already migrated table unchanged. The identidad Deployment
runs it as an init container on every pod start, so replicas starting together take
turns on a Postgres advisory lock:

    python -m identidad.kyc.migrate
"""

from solventa_common.db import build_engine
from solventa_common.settings import ServiceSettings
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from identidad.kyc.adapters.account_repository import accounts

# Only the database settings: the init container does not receive SESION_SECRETO.
settings = ServiceSettings(service_name="identidad")

_LOCK_KEY = 7_340_001

_COLUMNS = {
    "nombre": "VARCHAR(120) NOT NULL DEFAULT ''",
    "apellido": "VARCHAR(120) NOT NULL DEFAULT ''",
    "email": "VARCHAR(254)",
    "tipo_documento": "VARCHAR(10) DEFAULT 'CC'",
    "numero_documento": "VARCHAR(30)",
    "telefono": "VARCHAR(30)",
    "fecha_nacimiento": "DATE",
}


def migrate(engine: Engine) -> None:
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _LOCK_KEY})
        inspector = inspect(conn)
        if not inspector.has_table("clientes"):
            return
        present = {column["name"] for column in inspector.get_columns("clientes")}
        for name, definition in _COLUMNS.items():
            if name not in present:
                conn.execute(text(f"ALTER TABLE clientes ADD COLUMN {name} {definition}"))
        if "correo" in present:
            conn.execute(text("UPDATE clientes SET email = LOWER(correo) WHERE email IS NULL OR email = ''"))
            if engine.dialect.name == "postgresql":
                conn.execute(text("ALTER TABLE clientes ALTER COLUMN correo DROP NOT NULL"))
        if {"password_hash", "salt"} <= present:
            accounts.create(conn, checkfirst=True)
            conn.execute(
                text(
                    "INSERT INTO cuentas (cliente_id, password_hash, salt) "
                    "SELECT id, password_hash, salt FROM clientes "
                    "WHERE password_hash IS NOT NULL AND password_hash <> '' AND salt IS NOT NULL AND salt <> '' "
                    "AND id NOT IN (SELECT cliente_id FROM cuentas)"
                )
            )
            if engine.dialect.name == "postgresql":
                conn.execute(text("ALTER TABLE clientes ALTER COLUMN password_hash DROP NOT NULL"))
                conn.execute(text("ALTER TABLE clientes ALTER COLUMN salt DROP NOT NULL"))
        conn.execute(text("UPDATE clientes SET numero_documento = NULL WHERE numero_documento = ''"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_email ON clientes (email)"))
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_numero_documento "
                "ON clientes (numero_documento) WHERE numero_documento IS NOT NULL"
            )
        )


def main() -> None:
    if not settings.database_url:
        raise SystemExit("La migración necesita DB_HOST y DB_NAME")
    migrate(build_engine(settings.database_url))


if __name__ == "__main__":
    main()
