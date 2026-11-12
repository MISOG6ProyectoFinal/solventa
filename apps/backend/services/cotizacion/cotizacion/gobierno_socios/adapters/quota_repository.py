"""Consumo por socio y ventana: Postgres (compartido por las réplicas) e InMemory (tests/local sin DB)."""

import threading
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, delete, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine import Engine

metadata = MetaData()

consumo_socios = Table(
    "consumo_socios",
    metadata,
    Column("socio_id", String(36), primary_key=True),
    Column("ventana_inicio", DateTime(timezone=True), primary_key=True),
    Column("solicitudes", Integer, nullable=False),
)


class PostgresQuotaCounter:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        self._insert = sqlite.insert if engine.dialect.name == "sqlite" else postgresql.insert

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def increment(self, socio_id: str, window_start: datetime) -> int:
        statement = self._insert(consumo_socios).values(socio_id=socio_id, ventana_inicio=window_start, solicitudes=1)
        statement = statement.on_conflict_do_update(
            index_elements=[consumo_socios.c.socio_id, consumo_socios.c.ventana_inicio],
            set_={"solicitudes": consumo_socios.c.solicitudes + 1},
        ).returning(consumo_socios.c.solicitudes)
        with self.engine.begin() as conn:
            used = conn.execute(statement).scalar_one()
            conn.execute(
                delete(consumo_socios).where(
                    consumo_socios.c.socio_id == socio_id, consumo_socios.c.ventana_inicio < window_start
                )
            )
        return used

    def count(self, socio_id: str, window_start: datetime) -> int:
        with self.engine.connect() as conn:
            used = conn.execute(
                select(consumo_socios.c.solicitudes).where(
                    consumo_socios.c.socio_id == socio_id, consumo_socios.c.ventana_inicio == window_start
                )
            ).scalar_one_or_none()
        return used or 0


class InMemoryQuotaCounter:
    def __init__(self) -> None:
        self.windows: dict[str, tuple[datetime, int]] = {}
        self._lock = threading.Lock()

    def increment(self, socio_id: str, window_start: datetime) -> int:
        with self._lock:
            start, used = self.windows.get(socio_id, (window_start, 0))
            used = used + 1 if start == window_start else 1
            self.windows[socio_id] = (window_start, used)
            return used

    def count(self, socio_id: str, window_start: datetime) -> int:
        start, used = self.windows.get(socio_id, (window_start, 0))
        return used if start == window_start else 0
