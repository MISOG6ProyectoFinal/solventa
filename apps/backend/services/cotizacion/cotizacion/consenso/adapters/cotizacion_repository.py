"""Persistencia de la cotización de negocio (una por oferta post-consenso)."""

from solventa_common.vigencia_cotizacion import VIGENTE_HASTA_DESCONOCIDO
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    MetaData,
    Numeric,
    String,
    Table,
    func,
    insert,
    inspect,
    select,
    text,
)
from sqlalchemy.engine import Engine

from cotizacion.consenso.domain.models import OfertaCotizacion, VigenciaPropuesta

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
    Column("vigente_hasta", String(40), nullable=True),
    Column("cliente_id", String(64), nullable=True),
    Column("degradada", Boolean, nullable=True, default=False),
    Column("senales", JSON, nullable=True),
)

COLUMNAS_POSTERIORES = {
    "datos_riesgo": "ALTER TABLE cotizaciones ADD COLUMN datos_riesgo JSON",
    "canal": "ALTER TABLE cotizaciones ADD COLUMN canal VARCHAR(16)",
    "vigente_hasta": "ALTER TABLE cotizaciones ADD COLUMN vigente_hasta VARCHAR(40)",
    "cliente_id": "ALTER TABLE cotizaciones ADD COLUMN cliente_id VARCHAR(64)",
    "degradada": "ALTER TABLE cotizaciones ADD COLUMN degradada BOOLEAN",
    "senales": "ALTER TABLE cotizaciones ADD COLUMN senales JSON",
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
                    vigente_hasta=oferta.vigente_hasta.isoformat(),
                    cliente_id=oferta.cliente_id,
                    degradada=oferta.degradada,
                    senales=[s.model_dump(mode="json") for s in oferta.senales],
                )
            )

    def get(self, cotizacion_id: str) -> OfertaCotizacion | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(cotizaciones).where(cotizaciones.c.id == cotizacion_id)).mappings().first()
        return _oferta(row) if row else None

    def count(self) -> int:
        with self.engine.connect() as conn:
            return int(conn.execute(select(func.count()).select_from(cotizaciones)).scalar_one())


class InMemoryCotizacionRepository:
    def __init__(self) -> None:
        self.items: list[OfertaCotizacion] = []

    def save(self, oferta: OfertaCotizacion) -> None:
        self.items.append(oferta)

    def get(self, cotizacion_id: str) -> OfertaCotizacion | None:
        return next((item for item in self.items if item.id == cotizacion_id), None)

    def count(self) -> int:
        return len(self.items)


def _oferta(row) -> OfertaCotizacion:
    vigente = row["vigente_hasta"] or VIGENTE_HASTA_DESCONOCIDO.isoformat()
    return OfertaCotizacion(
        id=row["id"],
        producto_id=row["producto_id"],
        prima=row["prima"],
        coberturas=row["coberturas"] or [],
        vigencia_propuesta=VigenciaPropuesta(desde=row["vigencia_desde"], hasta=row["vigencia_hasta"]),
        vigente_hasta=vigente,
        version_reglas=row["version_reglas"],
        datos_riesgo=row["datos_riesgo"] or {},
        canal=row["canal"] or "web",
        cliente_id=row["cliente_id"],
        degradada=bool(row["degradada"]),
        senales=row["senales"] or [],
    )
