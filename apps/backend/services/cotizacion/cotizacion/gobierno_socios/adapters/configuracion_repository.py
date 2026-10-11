"""Configuración de ramos por socio: Postgres (fuente de verdad) e InMemory (tests/local sin DB)."""

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Table, delete, insert, select
from sqlalchemy.engine import Engine

from cotizacion.gobierno_socios.adapters.repository import metadata
from cotizacion.gobierno_socios.domain.configuracion import ConfiguracionSocio, RamoHabilitado

configuraciones = Table(
    "socio_configuraciones",
    metadata,
    Column("socio_id", String(36), ForeignKey("socios.id"), primary_key=True),
    Column("actualizado_en", DateTime(timezone=True), nullable=False),
    Column("actualizado_por", String(120), nullable=False),
)

ramos_habilitados = Table(
    "socio_ramos_habilitados",
    metadata,
    Column("socio_id", String(36), ForeignKey("socios.id"), primary_key=True),
    Column("ramo_id", String(64), primary_key=True),
    Column("coberturas", JSON, nullable=False),
)


class PostgresConfiguracionRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def get(self, socio_id: str) -> ConfiguracionSocio | None:
        with self.engine.connect() as conn:
            cabecera = (
                conn.execute(select(configuraciones).where(configuraciones.c.socio_id == socio_id)).mappings().first()
            )
            if cabecera is None:
                return None
            filas = conn.execute(
                select(ramos_habilitados)
                .where(ramos_habilitados.c.socio_id == socio_id)
                .order_by(ramos_habilitados.c.ramo_id)
            ).mappings()
            ramos = [RamoHabilitado(ramo_id=f["ramo_id"], coberturas=f["coberturas"]) for f in filas]
        return ConfiguracionSocio(**cabecera, ramos=ramos)

    def save(self, configuracion: ConfiguracionSocio) -> None:
        socio_id = configuracion.socio_id
        with self.engine.begin() as conn:
            conn.execute(delete(ramos_habilitados).where(ramos_habilitados.c.socio_id == socio_id))
            conn.execute(delete(configuraciones).where(configuraciones.c.socio_id == socio_id))
            conn.execute(
                insert(configuraciones).values(
                    socio_id=socio_id,
                    actualizado_en=configuracion.actualizado_en,
                    actualizado_por=configuracion.actualizado_por,
                )
            )
            if configuracion.ramos:
                conn.execute(
                    insert(ramos_habilitados),
                    [{"socio_id": socio_id, **ramo.model_dump()} for ramo in configuracion.ramos],
                )

    def ramos_por_socio(self) -> dict[str, list[str]]:
        stmt = select(ramos_habilitados.c.socio_id, ramos_habilitados.c.ramo_id)
        resultado: dict[str, list[str]] = {}
        with self.engine.connect() as conn:
            for socio_id, ramo_id in conn.execute(stmt):
                resultado.setdefault(socio_id, []).append(ramo_id)
        return resultado


class InMemoryConfiguracionRepository:
    def __init__(self) -> None:
        self.configuraciones: dict[str, ConfiguracionSocio] = {}

    def get(self, socio_id: str) -> ConfiguracionSocio | None:
        return self.configuraciones.get(socio_id)

    def save(self, configuracion: ConfiguracionSocio) -> None:
        self.configuraciones[configuracion.socio_id] = configuracion

    def ramos_por_socio(self) -> dict[str, list[str]]:
        return {socio_id: [r.ramo_id for r in c.ramos] for socio_id, c in self.configuraciones.items()}
