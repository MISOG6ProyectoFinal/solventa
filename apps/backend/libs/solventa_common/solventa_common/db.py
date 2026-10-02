"""Acceso a la base relacional dueña del servicio (Database-per-Service)."""

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def build_engine(database_url: str) -> Engine:
    # RDS Proxy agrupa las conexiones; el pool local se mantiene pequeño a propósito.
    return create_engine(database_url, pool_size=5, max_overflow=5, pool_pre_ping=True)


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def session_scope(factory: sessionmaker[Session]) -> Iterator[Session]:
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def db_ping(engine: Engine) -> bool:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True


def optional_engine(database_url: str | None) -> Engine | None:
    """Los servicios sin almacén propio (BFF, notificaciones) no crean engine."""
    return build_engine(database_url) if database_url else None


def readiness_checks(engine: Engine | None) -> dict:
    return {"db": lambda: db_ping(engine)} if engine is not None else {}
