"""Persistencia del cobro. Una fila por referencia de origen y una clave de idempotencia única."""

import threading

from sqlalchemy import insert, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from pagos.cobros.adapters.schema import cobros, ensure_schema
from pagos.cobros.domain.models import Cobro, EstadoCobro, TipoReferencia
from pagos.cobros.domain.ports import CobroDuplicado


class PostgresCobroRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        ensure_schema(self.engine)

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

    def get_by_reference(self, tipo_referencia: TipoReferencia, referencia_id: str) -> Cobro | None:
        with self.engine.connect() as conn:
            rows = (
                conn.execute(
                    select(cobros).where(
                        cobros.c.tipo_referencia == tipo_referencia.value,
                        cobros.c.referencia_id == referencia_id,
                    )
                )
                .mappings()
                .all()
            )
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
            if cobro.idempotency_key in self.items or _preferido(_de_referencia(self.items.values(), cobro)):
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

    def get_by_reference(self, tipo_referencia: TipoReferencia, referencia_id: str) -> Cobro | None:
        with self._lock:
            return _preferido(
                cobro
                for cobro in self.items.values()
                if cobro.tipo_referencia == tipo_referencia and cobro.referencia_id == referencia_id
            )

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


def _cobro(row) -> Cobro:
    cotizacion_id = row["cotizacion_id"]
    tipo = row["tipo_referencia"] or TipoReferencia.COTIZACION
    referencia = row["referencia_id"] or cotizacion_id
    return Cobro(
        id=row["id"],
        tipo_referencia=TipoReferencia(tipo),
        referencia_id=referencia,
        cotizacion_id=cotizacion_id,
        cliente_id=row["cliente_id"],
        monto=row["monto"],
        moneda=row["moneda"],
        estado=EstadoCobro(row["estado"]),
        idempotency_key=row["idempotency_key"],
        creado_en=row["creado_en"],
    )


def _de_referencia(cobros_guardados, cobro: Cobro) -> list[Cobro]:
    return [
        actual
        for actual in cobros_guardados
        if actual.tipo_referencia == cobro.tipo_referencia and actual.referencia_id == cobro.referencia_id
    ]


def _preferido(encontrados) -> Cobro | None:
    candidatos = list(encontrados)
    for estado in (EstadoCobro.APROBADO, EstadoCobro.PROCESANDO, EstadoCobro.RECHAZADO):
        for cobro in candidatos:
            if cobro.estado == estado:
                return cobro
    return None


def _values(cobro: Cobro) -> dict:
    values = cobro.model_dump()
    values["estado"] = cobro.estado.value
    values["tipo_referencia"] = cobro.tipo_referencia.value
    return values
