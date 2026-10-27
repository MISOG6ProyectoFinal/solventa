from datetime import date

from sqlalchemy import Column, Date, MetaData, String, Table, insert, select, text, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from identidad.kyc.domain.models import Client

metadata = MetaData()

clients = Table(
    "clientes",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("correo", String(254), nullable=True),
    Column("tipo_documento", String(10), nullable=True, default="CC"),
    Column("numero_documento", String(30), nullable=True, index=True),
    Column("nombre", String(120), nullable=False),
    Column("fecha_nacimiento", Date, nullable=True),
    Column("email", String(254), nullable=False, unique=True),
    Column("telefono", String(30), nullable=True),
    Column("pais", String(50), nullable=True, default="Colombia"),
    Column("apellido", String(120), nullable=True, default=""),
    Column("password_hash", String(64), nullable=True, default=""),
    Column("salt", String(32), nullable=True, default=""),
)


def _parse_date(val: date | str | None) -> date | None:
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        return date.fromisoformat(str(val).split("T")[0])
    except Exception:
        return None


def _client(row) -> Client:
    email = row.get("email") or row.get("correo") or ""
    return Client(
        id=row["id"],
        email=email,
        nombre=row.get("nombre") or "",
        last_name=row.get("apellido") or "",
        tipo_documento=row.get("tipo_documento") or "CC",
        numero_documento=row.get("numero_documento") or "",
        fecha_nacimiento=row.get("fecha_nacimiento"),
        telefono=row.get("telefono") or "",
        pais=row.get("pais") or "Colombia",
        password_hash=row.get("password_hash") or "",
        salt=row.get("salt") or "",
    )


def _merge_and_save_client(repo, client: Client) -> Client:
    existing = None
    if client.numero_documento:
        existing = repo.get_by_documento(client.tipo_documento, client.numero_documento)
    if not existing and client.id:
        existing = repo.get(client.id)
    if not existing and client.email and not client.numero_documento:
        existing = repo.get_by_email(client.email)

    if existing:
        existing.nombre = client.nombre or existing.nombre
        existing.last_name = client.last_name or existing.last_name
        existing.telefono = client.telefono or existing.telefono
        existing.email = client.email or existing.email
        existing.tipo_documento = client.tipo_documento or existing.tipo_documento
        existing.numero_documento = client.numero_documento or existing.numero_documento
        existing.pais = client.pais or existing.pais
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
                try:
                    conn.execute(text("ALTER TABLE clientes ALTER COLUMN correo DROP NOT NULL;"))
                except Exception:
                    pass
                conn.execute(
                    text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(10) DEFAULT 'CC';")
                )
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(30);"))
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email VARCHAR(254);"))
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefono VARCHAR(30);"))
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;"))
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS pais VARCHAR(50) DEFAULT 'Colombia';"))
                conn.execute(text("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS apellido VARCHAR(120) DEFAULT '';"))
                try:
                    conn.execute(
                        text(
                            "CREATE UNIQUE INDEX IF NOT EXISTS ix_clientes_email_unique"
                            " ON clientes (LOWER(email)) WHERE email IS NOT NULL AND email != '';"
                        )
                    )
                except Exception:
                    pass
                try:
                    conn.execute(text("UPDATE clientes SET email = correo WHERE email IS NULL OR email = '';"))
                except Exception:
                    pass
                try:
                    conn.execute(text("UPDATE clientes SET correo = email WHERE correo IS NULL OR correo = '';"))
                except Exception:
                    pass
        except Exception:
            pass

    def add(self, client: Client) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    insert(clients).values(
                        id=client.id,
                        correo=client.email,
                        tipo_documento=client.tipo_documento,
                        numero_documento=client.numero_documento,
                        nombre=client.nombre,
                        fecha_nacimiento=_parse_date(client.fecha_nacimiento),
                        email=client.email,
                        telefono=client.telefono,
                        pais=client.pais,
                        apellido=client.last_name or "",
                        password_hash=client.password_hash or "",
                        salt=client.salt or "",
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
                    correo=client.email,
                    tipo_documento=client.tipo_documento,
                    numero_documento=client.numero_documento,
                    nombre=client.nombre,
                    apellido=client.last_name or "",
                    fecha_nacimiento=_parse_date(client.fecha_nacimiento),
                    email=client.email,
                    telefono=client.telefono,
                    pais=client.pais,
                )
            )

    def upsert(self, client: Client) -> Client:
        return _merge_and_save_client(self, client)

    def get(self, client_id: str) -> Client | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(clients).where(clients.c.id == client_id)).mappings().first()
        return _client(row) if row else None

    def get_by_documento(self, tipo: str, numero: str) -> Client | None:
        with self.engine.connect() as conn:
            row = (
                conn.execute(
                    select(clients).where(
                        (clients.c.numero_documento == numero)
                        & ((clients.c.tipo_documento == tipo) | (clients.c.tipo_documento.is_(None)))
                    )
                )
                .mappings()
                .first()
            )
        return _client(row) if row else None

    def get_by_email(self, email: str) -> Client | None:
        normalized = email.lower()
        with self.engine.connect() as conn:
            row = (
                conn.execute(select(clients).where((clients.c.email == normalized) | (clients.c.correo == normalized)))
                .mappings()
                .first()
            )
        return _client(row) if row else None


class InMemoryClientRepository:
    def __init__(self) -> None:
        self.clients_by_id: dict[str, Client] = {}
        self.clients_by_email: dict[str, Client] = {}

    def create_schema(self) -> None:
        # Repositorio en memoria no requiere crear esquemas relacionales DDL
        pass

    def add(self, client: Client) -> None:
        if client.email in self.clients_by_email:
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

    def get_by_documento(self, tipo: str, numero: str) -> Client | None:
        for c in self.clients_by_id.values():
            if c.numero_documento == numero and (not tipo or c.tipo_documento == tipo):
                return c
        return None

    def get_by_email(self, email: str) -> Client | None:
        return self.clients_by_email.get(email.lower())
