"""Repositorio de socios: Postgres (fuente de verdad) e InMemory (tests/local sin DB)."""

from sqlalchemy import JSON, Column, DateTime, Integer, MetaData, String, Table, insert, inspect, select, text, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from cotizacion.gobierno_socios.domain.models import CredentialEvent, IdentificadorDuplicado, Socio

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
    Column("secreto_anterior_hash", String(64), nullable=True),
    Column("secreto_anterior_vence", DateTime(timezone=True), nullable=True),
)

credential_events = Table(
    "eventos_credencial",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("socio_id", String(36), nullable=False, index=True),
    Column("tipo", String(16), nullable=False),
    Column("actor", String(120), nullable=False),
    Column("fecha", DateTime(timezone=True), nullable=False),
    Column("gracia_hasta", DateTime(timezone=True), nullable=True),
)

_ADDED_COLUMNS = (socios.c.secreto_anterior_hash, socios.c.secreto_anterior_vence)


class PostgresSocioRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)
        existing = {column["name"] for column in inspect(self.engine).get_columns(socios.name)}
        with self.engine.begin() as conn:
            for column in _ADDED_COLUMNS:
                if column.name not in existing:
                    column_type = column.type.compile(self.engine.dialect)
                    conn.execute(text(f"ALTER TABLE {socios.name} ADD COLUMN {column.name} {column_type}"))

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

    def update_credential(self, socio: Socio, event: CredentialEvent) -> None:
        values = socio.model_dump(
            include={
                "secreto_hash",
                "secreto_enmascarado",
                "estado_credencial",
                "secreto_anterior_hash",
                "secreto_anterior_vence",
            }
        )
        with self.engine.begin() as conn:
            conn.execute(update(socios).where(socios.c.id == socio.id).values(**values))
            conn.execute(insert(credential_events).values(**event.model_dump()))

    def credential_events(self, socio_id: str) -> list[CredentialEvent]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(credential_events).where(credential_events.c.socio_id == socio_id)).mappings()
            return [CredentialEvent(**row) for row in rows]

    def update_quota(self, socio_id: str, quota: int) -> Socio | None:
        with self.engine.begin() as conn:
            conn.execute(update(socios).where(socios.c.id == socio_id).values(cuota_consumo=quota))
        return self.get(socio_id)

    def _first(self, condition) -> Socio | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(socios).where(condition)).mappings().first()
        return Socio(**row) if row else None


class InMemorySocioRepository:
    def __init__(self) -> None:
        self.socios: dict[str, Socio] = {}
        self.events: list[CredentialEvent] = []

    def update_credential(self, socio: Socio, event: CredentialEvent) -> None:
        self.socios[socio.id] = socio
        self.events.append(event)

    def credential_events(self, socio_id: str) -> list[CredentialEvent]:
        return [event for event in self.events if event.socio_id == socio_id]

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

    def update_quota(self, socio_id: str, quota: int) -> Socio | None:
        socio = self.socios.get(socio_id)
        if socio is None:
            return None
        self.socios[socio_id] = socio.model_copy(update={"cuota_consumo": quota})
        return self.socios[socio_id]
