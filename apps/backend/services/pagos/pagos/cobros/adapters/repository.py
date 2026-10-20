"""Persistencia del cobro. Una fila por cotización y una clave de idempotencia única."""

import threading

from sqlalchemy import Column, DateTime, MetaData, Numeric, String, Table, func, insert, select, text, update
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
        with self.engine.begin() as conn:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_cobros_cotizacion_id ON cobros (cotizacion_id)"))

    def add(self, cobro: Cobro) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(insert(cobros).values(**_values(cobro)))
        except IntegrityError as exc:
            raise CobroDuplicado(cobro.idempotency_key) from exc

    def update(self, cobro: Cobro) -> None:
        with self.engine.begin() as conn:
            conn.execute(update(cobros).where(cobros.c.id == cobro.id).values(estado=cobro.estado.value))

    def get(self, payment_id: str) -> Cobro | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(cobros).where(cobros.c.id == payment_id)).mappings().first()
        return _cobro(row) if row else None

    def get_by_idempotency_key(self, idempotency_key: str) -> Cobro | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(cobros).where(cobros.c.idempotency_key == idempotency_key)).mappings().first()
        return _cobro(row) if row else None

    def get_by_cotizacion_id(self, cotizacion_id: str) -> Cobro | None:
        with self.engine.connect() as conn:
            rows = conn.execute(select(cobros).where(cobros.c.cotizacion_id == cotizacion_id)).mappings().all()
        return _preferido([_cobro(row) for row in rows])

    def claim_nuevo_intento(self, cobro_id: str, clave_actual: str, reemplazo: Cobro) -> Cobro | None:
        valores = {
            "estado": reemplazo.estado.value,
            "idempotency_key": reemplazo.idempotency_key,
            "monto": reemplazo.monto,
            "moneda": reemplazo.moneda,
            "cliente_id": reemplazo.cliente_id,
        }
        try:
            with self.engine.begin() as conn:
                result = conn.execute(
                    update(cobros)
                    .where(
                        cobros.c.id == cobro_id,
                        cobros.c.idempotency_key == clave_actual,
                        cobros.c.estado == EstadoCobro.RECHAZADO.value,
                    )
                    .values(**valores)
                )
                if result.rowcount != 1:
                    return None
        except IntegrityError:
            return None
        return self.get_by_idempotency_key(reemplazo.idempotency_key)


class InMemoryCobroRepository:
    def __init__(self) -> None:
        self.items: dict[str, Cobro] = {}
        self._lock = threading.Lock()

    def add(self, cobro: Cobro) -> None:
        with self._lock:
            if cobro.idempotency_key in self.items or _preferido(list(self.items.values()), cobro.cotizacion_id):
                raise CobroDuplicado(cobro.idempotency_key)
            self.items[cobro.idempotency_key] = cobro

    def update(self, cobro: Cobro) -> None:
        with self._lock:
            self.items[cobro.idempotency_key] = cobro

    def get(self, payment_id: str) -> Cobro | None:
        with self._lock:
            return next((cobro for cobro in self.items.values() if cobro.id == payment_id), None)

    def get_by_idempotency_key(self, idempotency_key: str) -> Cobro | None:
        with self._lock:
            return self.items.get(idempotency_key)

    def get_by_cotizacion_id(self, cotizacion_id: str) -> Cobro | None:
        with self._lock:
            return _preferido(list(self.items.values()), cotizacion_id)

    def claim_nuevo_intento(self, cobro_id: str, clave_actual: str, reemplazo: Cobro) -> Cobro | None:
        with self._lock:
            actual = self.items.get(clave_actual)
            if actual is None or actual.id != cobro_id or actual.estado != EstadoCobro.RECHAZADO:
                return None
            if reemplazo.idempotency_key != clave_actual and reemplazo.idempotency_key in self.items:
                return None
            del self.items[clave_actual]
            self.items[reemplazo.idempotency_key] = reemplazo
            return reemplazo


def _preferido(encontrados: list[Cobro], cotizacion_id: str | None = None) -> Cobro | None:
    candidatos = [cobro for cobro in encontrados if cotizacion_id is None or cobro.cotizacion_id == cotizacion_id]
    for estado in (EstadoCobro.APROBADO, EstadoCobro.PROCESANDO, EstadoCobro.RECHAZADO):
        for cobro in candidatos:
            if cobro.estado == estado:
                return cobro
    return None


def _values(cobro: Cobro) -> dict:
    values = cobro.model_dump()
    values["estado"] = cobro.estado.value
    return values
