"""Tipos de endoso y los ramos en que aplican: Postgres (fuente de verdad) e InMemory (tests/local sin DB)."""

from sqlalchemy import JSON, Column, Integer, MetaData, String, Table, func, insert, select
from sqlalchemy.engine import Engine

from polizas.ciclo_vida.domain.models import TIPO_ENDOSO_DATOS_ASEGURADO, EndorsementType

metadata = MetaData()

endorsement_types = Table(
    "tipos_endoso",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("nombre", String(120), nullable=False),
    Column("ramos", JSON, nullable=False),
    Column("orden", Integer, nullable=False),
)

SEED_ENDORSEMENT_TYPES = (
    EndorsementType(id=TIPO_ENDOSO_DATOS_ASEGURADO, nombre="Datos del asegurado"),
    EndorsementType(
        id="beneficiarios",
        nombre="Beneficiarios",
        ramos=["ramo-vida", "ramo-microseguro-vida", "ramo-vida-hipotecario"],
    ),
    EndorsementType(
        id="suma-asegurada",
        nombre="Suma asegurada",
        ramos=[
            "ramo-vida",
            "ramo-microseguro-vida",
            "ramo-vida-hipotecario",
            "ramo-hogar",
            "ramo-auto",
            "ramo-dispositivos",
        ],
    ),
)


class PostgresEndorsementTypeRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)
        with self.engine.begin() as conn:
            if conn.execute(select(func.count()).select_from(endorsement_types)).scalar_one() == 0:
                conn.execute(
                    insert(endorsement_types),
                    [{**item.model_dump(), "orden": order} for order, item in enumerate(SEED_ENDORSEMENT_TYPES)],
                )

    def list_types(self) -> list[EndorsementType]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(endorsement_types).order_by(endorsement_types.c.orden)).mappings().all()
        return [EndorsementType(id=row["id"], nombre=row["nombre"], ramos=row["ramos"]) for row in rows]


class InMemoryEndorsementTypeRepository:
    def __init__(self) -> None:
        self.types = list(SEED_ENDORSEMENT_TYPES)

    def list_types(self) -> list[EndorsementType]:
        return list(self.types)
