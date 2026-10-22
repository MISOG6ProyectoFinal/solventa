from sqlalchemy import text
from sqlalchemy.engine import Engine

from siniestros.prestadores.domain.models import MAX_RESULTADOS, ConsultaCercanos, Prestador

SCHEMA = (
    "CREATE EXTENSION IF NOT EXISTS postgis",
    """
    CREATE TABLE IF NOT EXISTS prestadores (
        origen varchar(16) NOT NULL,
        origen_id varchar(64) NOT NULL,
        nombre varchar(255) NOT NULL,
        tipo varchar(32) NOT NULL,
        calificacion numeric(2, 1),
        ubicacion geography(Point, 4326) NOT NULL,
        PRIMARY KEY (origen, origen_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS prestadores_ubicacion_gix ON prestadores USING GIST (ubicacion)",
)

UPSERT = text(
    """
    INSERT INTO prestadores (origen, origen_id, nombre, tipo, calificacion, ubicacion)
    VALUES (:origen, :origen_id, :nombre, :tipo, :calificacion,
            ST_SetSRID(ST_MakePoint(:longitud, :latitud), 4326)::geography)
    ON CONFLICT (origen, origen_id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        tipo = EXCLUDED.tipo,
        calificacion = EXCLUDED.calificacion,
        ubicacion = EXCLUDED.ubicacion
    """
)

# ST_DWithin and the `<->` ordering both use the GiST index. ST_Distance returns meters.
CERCANOS = """
    SELECT origen, origen_id, nombre, tipo, calificacion,
           ST_Y(ubicacion::geometry) AS latitud,
           ST_X(ubicacion::geometry) AS longitud,
           ST_Distance(ubicacion, punto.geog) / 1000 AS distancia_km
    FROM prestadores, (SELECT ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography AS geog) AS punto
    WHERE ST_DWithin(ubicacion, punto.geog, :radio_m)
    {filtro_tipo}
    ORDER BY ubicacion <-> punto.geog
    LIMIT :limite
"""


class PostgisPrestadorRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        with self.engine.begin() as conn:
            for statement in SCHEMA:
                conn.execute(text(statement))

    def upsert(self, prestadores: list[Prestador]) -> None:
        if not prestadores:
            return
        with self.engine.begin() as conn:
            conn.execute(UPSERT, [prestador.model_dump() for prestador in prestadores])

    def cercanos(self, consulta: ConsultaCercanos) -> list[tuple[Prestador, float]]:
        params = {
            "lat": consulta.lat,
            "lon": consulta.lon,
            "radio_m": consulta.radio_km * 1000,
            "limite": MAX_RESULTADOS,
        }
        filtro = ""
        if consulta.servicio is not None:
            filtro = "AND tipo = :tipo"
            params["tipo"] = consulta.servicio
        with self.engine.connect() as conn:
            rows = conn.execute(text(CERCANOS.format(filtro_tipo=filtro)), params).mappings().all()
        return [
            (
                Prestador(
                    origen=row["origen"],
                    origen_id=row["origen_id"],
                    nombre=row["nombre"],
                    tipo=row["tipo"],
                    latitud=row["latitud"],
                    longitud=row["longitud"],
                    calificacion=None if row["calificacion"] is None else float(row["calificacion"]),
                ),
                float(row["distancia_km"]),
            )
            for row in rows
        ]
