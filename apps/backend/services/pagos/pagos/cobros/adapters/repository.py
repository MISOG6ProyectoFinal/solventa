"""Persistencia del cobro. La clave de idempotencia es única."""

from sqlalchemy import Column, DateTime, MetaData, Numeric, String, Table, func, insert, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from pagos.cobros.domain.models import Cobro, EstadoCobro
from pagos.cobros.domain.ports import CobroDuplicado

metadata = MetaData()

cobros = Table(
    "cobros",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("cotizacion_id", String(64), nullable=False),
    Column("cliente_id", String(64), nullable=False),
    Column("monto", Numeric(18, 2), nullable=False),
    Column("moneda", String(3), nullable=False),
    Column("estado", String(16), nullable=False),
    Column("idempotency_key", String(255), nullable=False, unique=True),
    Column("creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False),
)


def _cobro(row) -> Cobro:
    return Cobro(
        id=row["id"],
        cotizacion_id=row["cotizacion_id"],
        cliente_id=row["cliente_id"],
        monto=row["monto"],
        moneda=row["moneda"],
        estado=EstadoCobro(row["estado"]),
        idempotency_key=row["idempotency_key"],
        creado_en=row["creado_en"],
    )


class PostgresCobroRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def add(self, cobro: Cobro) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(insert(cobros).values(**_values(cobro)))
        except IntegrityError as exc:
            raise CobroDuplicado(cobro.idempotency_key) from exc

    def update(self, cobro: Cobro) -> None:
        with self.engine.begin() as conn:
            conn.execute(update(cobros).where(cobros.c.id == cobro.id).values(estado=cobro.estado.value))

    def get_by_idempotency_key(self, idempotency_key: str) -> Cobro | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(cobros).where(cobros.c.idempotency_key == idempotency_key)).mappings().first()
        return _cobro(row) if row else None


class InMemoryCobroRepository:
    def __init__(self) -> None:
        self.items: dict[str, Cobro] = {}

    def add(self, cobro: Cobro) -> None:
        if cobro.idempotency_key in self.items:
            raise CobroDuplicado(cobro.idempotency_key)
        self.items[cobro.idempotency_key] = cobro

    def update(self, cobro: Cobro) -> None:
        self.items[cobro.idempotency_key] = cobro

    def get_by_idempotency_key(self, idempotency_key: str) -> Cobro | None:
        return self.items.get(idempotency_key)


def _values(cobro: Cobro) -> dict:
    values = cobro.model_dump()
    values["estado"] = cobro.estado.value
    return values
