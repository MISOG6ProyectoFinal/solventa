"""Persistencia de la cotización de negocio (una por oferta post-consenso)."""

from sqlalchemy import JSON, Column, Date, MetaData, Numeric, String, Table, func, insert, inspect, select, text
from sqlalchemy.engine import Engine

from cotizacion.consenso.domain.models import OfertaCotizacion

metadata = MetaData()

cotizaciones = Table(
    "cotizaciones",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("producto_id", String(64), nullable=False, index=True),
    Column("prima", Numeric(18, 2), nullable=False),
    Column("coberturas", JSON, nullable=False),
    Column("vigencia_desde", Date, nullable=False),
    Column("vigencia_hasta", Date, nullable=False),
    Column("version_reglas", String(64), nullable=False),
    Column("datos_riesgo", JSON, nullable=True),
    Column("canal", String(16), nullable=True, default="web"),
)

COLUMNAS_POSTERIORES = {
    "datos_riesgo": "ALTER TABLE cotizaciones ADD COLUMN datos_riesgo JSON",
    "canal": "ALTER TABLE cotizaciones ADD COLUMN canal VARCHAR(16)",
}


class PostgresCotizacionRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)
        presentes = {columna["name"] for columna in inspect(self.engine).get_columns("cotizaciones")}
        with self.engine.begin() as conn:
            for columna, ddl in COLUMNAS_POSTERIORES.items():
                if columna not in presentes:
                    conn.execute(text(ddl))

    def save(self, oferta: OfertaCotizacion) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                insert(cotizaciones).values(
                    id=oferta.id,
                    producto_id=oferta.producto_id,
                    prima=oferta.prima,
                    coberturas=[c.model_dump() for c in oferta.coberturas],
                    vigencia_desde=oferta.vigencia_propuesta.desde,
                    vigencia_hasta=oferta.vigencia_propuesta.hasta,
                    version_reglas=oferta.version_reglas,
                    datos_riesgo=oferta.datos_riesgo,
                    canal=oferta.canal,
                )
            )

    def count(self) -> int:
        with self.engine.connect() as conn:
            return int(conn.execute(select(func.count()).select_from(cotizaciones)).scalar_one())


class InMemoryCotizacionRepository:
    def __init__(self) -> None:
        self.items: list[OfertaCotizacion] = []

    def save(self, oferta: OfertaCotizacion) -> None:
        self.items.append(oferta)

    def count(self) -> int:
        return len(self.items)
