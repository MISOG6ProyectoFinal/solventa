"""Reglas de rating versionadas: Postgres (fuente de verdad) e InMemory (tests/local sin DB)."""

from datetime import UTC, datetime

from sqlalchemy import JSON, Column, DateTime, MetaData, String, Table, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from cotizacion.rating.domain.rating import NoRulesPublished, ReglasRating, RulesVersionAlreadyPublished

metadata = MetaData()

rating_rules = Table(
    "reglas_rating",
    metadata,
    Column("version", String(32), primary_key=True),
    Column("publicada_en", DateTime(timezone=True), nullable=False, index=True),
    Column("reglas", JSON, nullable=False),
)


class PostgresRulesRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def current(self) -> ReglasRating:
        with self.engine.connect() as conn:
            row = (
                conn.execute(select(rating_rules.c.reglas).order_by(rating_rules.c.publicada_en.desc()).limit(1))
                .mappings()
                .first()
            )
        if row is None:
            raise NoRulesPublished()
        return ReglasRating.model_validate(row["reglas"])

    def publish(self, reglas: ReglasRating) -> None:
        values = {
            "version": reglas.version,
            "publicada_en": datetime.now(UTC),
            "reglas": reglas.model_dump(mode="json"),
        }
        try:
            with self.engine.begin() as conn:
                conn.execute(insert(rating_rules).values(**values))
        except IntegrityError as exc:
            raise RulesVersionAlreadyPublished(reglas.version) from exc

    def versions(self) -> list[str]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(rating_rules.c.version).order_by(rating_rules.c.publicada_en.desc()))
            return [row[0] for row in rows]


class InMemoryRulesRepository:
    def __init__(self) -> None:
        self.published: list[ReglasRating] = []

    def create_schema(self) -> None:
        return None

    def current(self) -> ReglasRating:
        if not self.published:
            raise NoRulesPublished()
        return self.published[-1]

    def publish(self, reglas: ReglasRating) -> None:
        if any(item.version == reglas.version for item in self.published):
            raise RulesVersionAlreadyPublished(reglas.version)
        self.published.append(reglas)

    def versions(self) -> list[str]:
        return [reglas.version for reglas in reversed(self.published)]
