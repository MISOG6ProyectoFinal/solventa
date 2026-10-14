from sqlalchemy import Column, MetaData, String, Table, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from identidad.kyc.domain.models import Client

metadata = MetaData()

clients = Table(
    "clientes",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("correo", String(254), nullable=False, unique=True),
    Column("password_hash", String(64), nullable=False),
    Column("salt", String(32), nullable=False),
)


def _client(row) -> Client:
    return Client(id=row["id"], email=row["correo"], password_hash=row["password_hash"], salt=row["salt"])


class PostgresClientRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def add(self, client: Client) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    insert(clients).values(
                        id=client.id,
                        correo=client.email,
                        password_hash=client.password_hash,
                        salt=client.salt,
                    )
                )
        except IntegrityError as exc:
            raise ValueError(client.email) from exc

    def get_by_email(self, email: str) -> Client | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(clients).where(clients.c.correo == email)).mappings().first()
        return _client(row) if row else None


class InMemoryClientRepository:
    def __init__(self) -> None:
        self.clients: dict[str, Client] = {}

    def add(self, client: Client) -> None:
        if client.email in self.clients:
            raise ValueError(client.email)
        self.clients[client.email] = client

    def get_by_email(self, email: str) -> Client | None:
        return self.clients.get(email)
