"""Acceso a la base relacional dueña del servicio (Database-per-Service)."""

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


POOL_TIMEOUT_S = 1
CONNECT_TIMEOUT_S = 2
PING_TIMEOUT_MS = 500


def build_engine(database_url: str) -> Engine:
    # RDS Proxy agrupa las conexiones; el pool local se mantiene pequeño a propósito.
    connect_args = {"connect_timeout": CONNECT_TIMEOUT_S} if database_url.startswith("postgresql") else {}
    return create_engine(
        database_url,
        pool_size=5,
        max_overflow=5,
        pool_timeout=POOL_TIMEOUT_S,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


def db_ping(engine: Engine) -> bool:
    with engine.connect() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(text(f"SET LOCAL statement_timeout = {PING_TIMEOUT_MS}"))
        conn.execute(text("SELECT 1"))
    return True


def optional_engine(database_url: str | None) -> Engine | None:
    """Los servicios sin almacén propio (BFF, notificaciones) no crean engine."""
    return build_engine(database_url) if database_url else None


def readiness_checks(engine: Engine | None) -> dict:
    return {"db": lambda: db_ping(engine)} if engine is not None else {}
