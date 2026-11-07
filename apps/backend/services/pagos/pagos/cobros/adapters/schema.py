"""Esquema de cobros: definición canónica y compatibilidad con tablas ya existentes."""

from sqlalchemy import Column, DateTime, MetaData, Numeric, String, Table, func, text
from sqlalchemy.engine import Connection, Engine

metadata = MetaData()

cobros = Table(
    "cobros",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("cotizacion_id", String(64), nullable=True),
    Column("cliente_id", String(64), nullable=False),
    Column("monto", Numeric(18, 2), nullable=False),
    Column("moneda", String(3), nullable=False),
    Column("estado", String(16), nullable=False),
    Column("idempotency_key", String(255), nullable=False, unique=True),
    Column("creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column("tipo_referencia", String(32), nullable=False),
    Column("referencia_id", String(255), nullable=False),
)


def ensure_schema(engine: Engine) -> None:
    metadata.create_all(engine)
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            _migrar_sqlite(conn)
        else:
            _migrar_postgres(conn)
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS uq_cobros_referencia ON cobros (tipo_referencia, referencia_id)")
        )
        conn.execute(text("DROP INDEX IF EXISTS uq_cobros_cotizacion_id"))


def _migrar_postgres(conn: Connection) -> None:
    conn.execute(text("ALTER TABLE cobros ADD COLUMN IF NOT EXISTS tipo_referencia VARCHAR(32)"))
    conn.execute(text("ALTER TABLE cobros ADD COLUMN IF NOT EXISTS referencia_id VARCHAR(255)"))
    conn.execute(
        text(
            "UPDATE cobros SET tipo_referencia = 'cotizacion', referencia_id = cotizacion_id "
            "WHERE tipo_referencia IS NULL"
        )
    )
    conn.execute(text("ALTER TABLE cobros ALTER COLUMN cotizacion_id DROP NOT NULL"))
    conn.execute(text("ALTER TABLE cobros ALTER COLUMN tipo_referencia SET NOT NULL"))
    conn.execute(text("ALTER TABLE cobros ALTER COLUMN referencia_id SET NOT NULL"))


def _migrar_sqlite(conn: Connection) -> None:
    info = {row["name"]: row for row in conn.execute(text("PRAGMA table_info(cobros)")).mappings()}
    if _esquema_actual(info):
        return
    tiene_referencia = "tipo_referencia" in info and "referencia_id" in info
    conn.execute(text("ALTER TABLE cobros RENAME TO cobros_legacy"))
    cobros.create(bind=conn)
    if tiene_referencia:
        conn.execute(
            text(
                """
                INSERT INTO cobros (
                    id, cotizacion_id, cliente_id, monto, moneda, estado, idempotency_key, creado_en,
                    tipo_referencia, referencia_id
                )
                SELECT
                    id, cotizacion_id, cliente_id, monto, moneda, estado, idempotency_key, creado_en,
                    COALESCE(tipo_referencia, 'cotizacion'),
                    COALESCE(referencia_id, cotizacion_id)
                FROM cobros_legacy
                """
            )
        )
    else:
        conn.execute(
            text(
                """
                INSERT INTO cobros (
                    id, cotizacion_id, cliente_id, monto, moneda, estado, idempotency_key, creado_en,
                    tipo_referencia, referencia_id
                )
                SELECT
                    id, cotizacion_id, cliente_id, monto, moneda, estado, idempotency_key, creado_en,
                    'cotizacion', cotizacion_id
                FROM cobros_legacy
                """
            )
        )
    conn.execute(text("DROP TABLE cobros_legacy"))


def _esquema_actual(info: dict) -> bool:
    necesarias = ("tipo_referencia", "referencia_id", "cotizacion_id")
    if any(nombre not in info for nombre in necesarias):
        return False
    return (
        not info["cotizacion_id"]["notnull"] and info["tipo_referencia"]["notnull"] and info["referencia_id"]["notnull"]
    )
