from datetime import UTC

from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from siniestros.asistencia.domain.errors import MSG_DUPLICADA, ReglaAsistencia
from siniestros.asistencia.domain.models import Asistencia

metadata = MetaData()

asistencias = Table(
    "asistencias",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("aviso_id", String(64), nullable=False, unique=True),
    Column("cliente_id", String(64), nullable=False),
    Column("servicio", String(32), nullable=False),
    Column("ubicacion", String(255), nullable=False),
    Column("gps", String(255)),
    Column("numero", String(16), nullable=False, unique=True),
    Column("eta_min", Integer, nullable=False),
    Column("eta_max", Integer, nullable=False),
    Column("estado", String(32), nullable=False),
    Column("solicitada_en", DateTime(timezone=True), nullable=False),
)


class PostgresAsistenciaRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def add(self, asistencia: Asistencia) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(insert(asistencias).values(**asistencia.model_dump()))
        except IntegrityError as exc:
            raise ReglaAsistencia(409, MSG_DUPLICADA) from exc

    def get_by_aviso(self, aviso_id: str) -> Asistencia | None:
        return self._one(asistencias.c.aviso_id == aviso_id)

    def get_by_numero(self, numero: str) -> Asistencia | None:
        return self._one(asistencias.c.numero == numero)

    def _one(self, condition) -> Asistencia | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(asistencias).where(condition)).mappings().first()
        if row is None:
            return None
        asistencia = Asistencia.model_validate(row)
        # SQLite returns naive datetimes. Postgres returns aware ones and is unchanged.
        if asistencia.solicitada_en.tzinfo is None:
            asistencia.solicitada_en = asistencia.solicitada_en.replace(tzinfo=UTC)
        return asistencia
