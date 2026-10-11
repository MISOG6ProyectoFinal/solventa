"""Repositorio de socios: Postgres (fuente de verdad) e InMemory (tests/local sin DB)."""

from sqlalchemy import JSON, Column, DateTime, Integer, MetaData, String, Table, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from cotizacion.gobierno_socios.domain.models import IdentificadorDuplicado, Socio

metadata = MetaData()

socios = Table(
    "socios",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("nombre", String(120), nullable=False),
    Column("identificador", String(63), nullable=False, unique=True),
    Column("tipo", String(32), nullable=False),
    Column("pais", String(120), nullable=False),
    Column("correo_contacto", String(254), nullable=False),
    Column("alcances", JSON, nullable=False),
    Column("client_id", String(64), nullable=False, unique=True),
    Column("secreto_hash", String(64), nullable=False),
    Column("secreto_enmascarado", String(32), nullable=False),
    Column("estado_credencial", String(16), nullable=False),
    Column("estado_contrato", String(16), nullable=False),
    Column("version_contrato", String(16), nullable=False),
    Column("cuota_consumo", Integer, nullable=False),
    Column("alta_fecha", DateTime(timezone=True), nullable=False),
    Column("alta_usuario", String(120), nullable=False),
)


class PostgresSocioRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def add(self, socio: Socio) -> None:
        # La unicidad la garantiza la base: dos altas simultáneas no pasan ambas.
        try:
            with self.engine.begin() as conn:
                conn.execute(insert(socios).values(**socio.model_dump()))
        except IntegrityError as exc:
            raise IdentificadorDuplicado(socio.identificador) from exc

    def list_socios(self) -> list[Socio]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(socios)).mappings().all()
        return [Socio(**row) for row in rows]

    def get(self, socio_id: str) -> Socio | None:
        return self._first(socios.c.id == socio_id)

    def get_by_client_id(self, client_id: str) -> Socio | None:
        return self._first(socios.c.client_id == client_id)

    def _first(self, condition) -> Socio | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(socios).where(condition)).mappings().first()
        return Socio(**row) if row else None


class InMemorySocioRepository:
    def __init__(self) -> None:
        self.socios: dict[str, Socio] = {}

    def add(self, socio: Socio) -> None:
        if any(s.identificador == socio.identificador for s in self.socios.values()):
            raise IdentificadorDuplicado(socio.identificador)
        self.socios[socio.id] = socio

    def list_socios(self) -> list[Socio]:
        return list(self.socios.values())

    def get(self, socio_id: str) -> Socio | None:
        return self.socios.get(socio_id)

    def get_by_client_id(self, client_id: str) -> Socio | None:
        return next((s for s in self.socios.values() if s.client_id == client_id), None)
