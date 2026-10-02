"""Idempotency Key Validator (Experimento 2).

Antes de liquidar, el consumidor reclama la clave única del evento. Solo el primer
reclamo gana; las reentregas del bus y los consumidores concurrentes reciben False.
La garantía la da la restricción de unicidad de la base, no un lock en memoria.
"""

import threading
from typing import Protocol

from sqlalchemy import Column, DateTime, MetaData, String, Table, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Engine


class IdempotencyKeyValidator(Protocol):
    def claim(self, key: str, scope: str) -> bool: ...


metadata = MetaData()

processed_keys = Table(
    "idempotency_keys",
    metadata,
    Column("scope", String(64), primary_key=True),
    Column("key", String(255), primary_key=True),
    Column("claimed_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
)


class PostgresIdempotencyKeyValidator:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def claim(self, key: str, scope: str) -> bool:
        stmt = insert(processed_keys).values(scope=scope, key=key).on_conflict_do_nothing()
        with self.engine.begin() as conn:
            return conn.execute(stmt).rowcount == 1


class InMemoryIdempotencyKeyValidator:
    def __init__(self) -> None:
        self._keys: set[tuple[str, str]] = set()
        self._lock = threading.Lock()

    def claim(self, key: str, scope: str) -> bool:
        with self._lock:
            if (scope, key) in self._keys:
                return False
            self._keys.add((scope, key))
            return True
