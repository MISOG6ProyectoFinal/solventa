from sqlalchemy import Column, Date, Index, MetaData, String, Table, insert, select, text, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from identidad.kyc.domain.models import Client

metadata = MetaData()

clients = Table(
    "clientes",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("tipo_documento", String(10), nullable=True, default="CC"),
    Column("numero_documento", String(30), nullable=True),
    Column("nombre", String(120), nullable=False),
    Column("fecha_nacimiento", Date, nullable=True),
    Column("email", String(254), nullable=False),
    Column("telefono", String(30), nullable=True),
    Column("apellido", String(120), nullable=True, default=""),
    Index("uq_clientes_email", "email", unique=True),
    Index(
        "uq_clientes_numero_documento",
        "numero_documento",
        unique=True,
        postgresql_where=text("numero_documento IS NOT NULL"),
        sqlite_where=text("numero_documento IS NOT NULL"),
    ),
)


def _client(row) -> Client:
    email = row.get("email") or ""
    return Client(
        id=row["id"],
        email=email,
        nombre=row.get("nombre") or "",
        tipo_documento=row.get("tipo_documento") or "CC",
        numero_documento=row.get("numero_documento") or "",
        fecha_nacimiento=row.get("fecha_nacimiento"),
        telefono=row.get("telefono") or "",
    )


def _merge_and_save_client(repo, client: Client) -> Client:
    existing = None
    if client.numero_documento:
        existing = repo.get_by_numero_documento(client.numero_documento)
    if not existing and client.email:
        existing = repo.get_by_email(client.email)
    if not existing and client.id:
        existing = repo.get(client.id)

    if existing:
        existing.nombre = client.nombre or existing.nombre
        existing.telefono = client.telefono or existing.telefono
        existing.email = client.email or existing.email
        existing.tipo_documento = client.tipo_documento or existing.tipo_documento
        existing.numero_documento = client.numero_documento or existing.numero_documento
        if client.fecha_nacimiento:
            existing.fecha_nacimiento = client.fecha_nacimiento
        repo.update(existing)
        return existing
    repo.add(client)
    return client


class PostgresClientRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(10) DEFAULT 'CC';")
                )
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(30);"))
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email VARCHAR(254);"))
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefono VARCHAR(30);"))
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;"))
        except Exception:
            pass

    def add(self, client: Client) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    insert(clients).values(
                        id=client.id,
                        tipo_documento=client.tipo_documento,
                        numero_documento=client.numero_documento or None,
                        nombre=client.nombre,
                        fecha_nacimiento=client.fecha_nacimiento if client.fecha_nacimiento else None,
                        email=client.email,
                        telefono=client.telefono,
                        apellido=client.last_name,
                    )
                )
        except IntegrityError as exc:
            raise ValueError(client.email) from exc

    def update(self, client: Client) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                update(clients)
                .where(clients.c.id == client.id)
                .values(
                    tipo_documento=client.tipo_documento,
                    numero_documento=client.numero_documento or None,
                    nombre=client.nombre,
                    fecha_nacimiento=client.fecha_nacimiento if client.fecha_nacimiento else None,
                    email=client.email,
                    telefono=client.telefono,
                )
            )

    def upsert(self, client: Client) -> Client:
        return _merge_and_save_client(self, client)

    def get(self, client_id: str) -> Client | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(clients).where(clients.c.id == client_id)).mappings().first()
        return _client(row) if row else None

    def get_by_numero_documento(self, numero: str) -> Client | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(clients).where(clients.c.numero_documento == numero)).mappings().first()
        return _client(row) if row else None

    def get_by_email(self, email: str) -> Client | None:
        normalized = email.lower()
        with self.engine.connect() as conn:
            row = conn.execute(select(clients).where(clients.c.email == normalized)).mappings().first()
        return _client(row) if row else None


class InMemoryClientRepository:
    def __init__(self) -> None:
        self.clients_by_id: dict[str, Client] = {}
        self.clients_by_email: dict[str, Client] = {}

    def create_schema(self) -> None:
        # Repositorio en memoria no requiere crear esquemas relacionales DDL
        pass

    def add(self, client: Client) -> None:
        if client.email in self.clients_by_email or self.get_by_numero_documento(client.numero_documento):
            raise ValueError(client.email)
        self.clients_by_id[client.id] = client
        self.clients_by_email[client.email.lower()] = client

    def update(self, client: Client) -> None:
        self.clients_by_id[client.id] = client
        self.clients_by_email[client.email.lower()] = client

    def upsert(self, client: Client) -> Client:
        return _merge_and_save_client(self, client)

    def get(self, client_id: str) -> Client | None:
        return self.clients_by_id.get(client_id)

    def get_by_numero_documento(self, numero: str) -> Client | None:
        if not numero:
            return None
        return next((c for c in self.clients_by_id.values() if c.numero_documento == numero), None)

    def get_by_email(self, email: str) -> Client | None:
        return self.clients_by_email.get(email.lower())
