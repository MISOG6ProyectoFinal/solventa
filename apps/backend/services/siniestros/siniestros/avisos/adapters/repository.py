from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, func, insert, select, update
from sqlalchemy.engine import Engine

from siniestros.avisos.domain.models import Aviso, Evidencia

metadata = MetaData()

avisos = Table(
    "avisos",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("poliza_id", String(64), nullable=False),
    Column("tipo", String(64), nullable=False),
    Column("ocurrido_en", DateTime(timezone=True), nullable=False),
    Column("descripcion", String, nullable=False),
    Column("ubicacion", String(255)),
    Column("estado", String(32), nullable=False),
    Column("creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False),
)

evidencias = Table(
    "evidencias",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("aviso_id", String(64), nullable=False, index=True),
    Column("object_key", String(512), nullable=False),
    Column("url", String(1024), nullable=False),
    Column("content_type", String(64), nullable=False),
    Column("bytes", Integer, nullable=False),
    Column("estado", String(32), nullable=False),
    Column("creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False),
)


def _aviso(row) -> Aviso:
    return Aviso(
        id=row["id"],
        poliza_id=row["poliza_id"],
        tipo=row["tipo"],
        ocurrido_en=row["ocurrido_en"],
        descripcion=row["descripcion"],
        ubicacion=row["ubicacion"],
        estado=row["estado"],
    )


def _evidencia(row) -> Evidencia:
    return Evidencia(
        id=row["id"],
        aviso_id=row["aviso_id"],
        object_key=row["object_key"],
        url=row["url"],
        content_type=row["content_type"],
        tamano=row["bytes"],
        estado=row["estado"],
    )


class PostgresAvisoRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def add_aviso(self, aviso: Aviso) -> None:
        values = aviso.model_dump()
        with self.engine.begin() as conn:
            conn.execute(insert(avisos).values(**values))

    def get_aviso(self, aviso_id: str) -> Aviso | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(avisos).where(avisos.c.id == aviso_id)).mappings().first()
        return _aviso(row) if row else None

    def add_evidencia(self, evidencia: Evidencia) -> None:
        with self.engine.begin() as conn:
            conn.execute(insert(evidencias).values(**_evidencia_values(evidencia)))

    def update_evidencia(self, evidencia: Evidencia) -> None:
        values = _evidencia_values(evidencia)
        evidencia_id = values.pop("id")
        with self.engine.begin() as conn:
            conn.execute(update(evidencias).where(evidencias.c.id == evidencia_id).values(**values))

    def get_evidencia(self, aviso_id: str, evidencia_id: str) -> Evidencia | None:
        query = select(evidencias).where(evidencias.c.id == evidencia_id, evidencias.c.aviso_id == aviso_id)
        with self.engine.connect() as conn:
            row = conn.execute(query).mappings().first()
        return _evidencia(row) if row else None

    def list_evidencias(self, aviso_id: str) -> list[Evidencia]:
        query = select(evidencias).where(evidencias.c.aviso_id == aviso_id)
        with self.engine.connect() as conn:
            rows = conn.execute(query).mappings().all()
        return [_evidencia(row) for row in rows]

    def count_activas(self, aviso_id: str) -> int:
        query = (
            select(func.count())
            .select_from(evidencias)
            .where(evidencias.c.aviso_id == aviso_id, evidencias.c.estado != "rechazada")
        )
        with self.engine.connect() as conn:
            return int(conn.execute(query).scalar_one())


def _evidencia_values(evidencia: Evidencia) -> dict:
    values = evidencia.model_dump(by_alias=True)
    return values
