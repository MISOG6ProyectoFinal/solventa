from sqlalchemy import Column, DateTime, MetaData, Numeric, String, Table, func, insert
from sqlalchemy.engine import Engine

from siniestro_parametrico.domain.models import Liquidacion

metadata = MetaData()

liquidaciones = Table(
    "liquidaciones_parametricas",
    metadata,
    Column("idempotency_key", String(255), primary_key=True),
    Column("poliza_id", String(64), nullable=False, index=True),
    Column("monto", Numeric(18, 2), nullable=False),
    Column("evento", String(64), nullable=False),
    Column("creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False),
)


class PostgresLiquidacionRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def save(self, liquidacion: Liquidacion) -> None:
        with self.engine.begin() as conn:
            conn.execute(insert(liquidaciones).values(**liquidacion.model_dump()))


class InMemoryLiquidacionRepository:
    def __init__(self) -> None:
        self.items: list[Liquidacion] = []

    def save(self, liquidacion: Liquidacion) -> None:
        self.items.append(liquidacion)
