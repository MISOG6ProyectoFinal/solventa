from sqlalchemy import Column, ForeignKey, String, Table, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from identidad.kyc.adapters.repository import metadata
from identidad.kyc.domain.models import Account

accounts = Table(
    "cuentas",
    metadata,
    Column("cliente_id", String(36), ForeignKey("clientes.id"), primary_key=True),
    Column("password_hash", String(64), nullable=False),
    Column("salt", String(32), nullable=False),
)


class PostgresAccountRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine, tables=[accounts])

    def add(self, account: Account) -> None:
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    insert(accounts).values(
                        cliente_id=account.client_id,
                        password_hash=account.password_hash,
                        salt=account.salt,
                    )
                )
        except IntegrityError as exc:
            raise ValueError(account.client_id) from exc

    def get(self, client_id: str) -> Account | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(accounts).where(accounts.c.cliente_id == client_id)).mappings().first()
        if row is None:
            return None
        return Account(client_id=row["cliente_id"], password_hash=row["password_hash"], salt=row["salt"])


class InMemoryAccountRepository:
    def __init__(self) -> None:
        self.accounts_by_client: dict[str, Account] = {}

    def create_schema(self) -> None:
        pass

    def add(self, account: Account) -> None:
        if account.client_id in self.accounts_by_client:
            raise ValueError(account.client_id)
        self.accounts_by_client[account.client_id] = account

    def get(self, client_id: str) -> Account | None:
        return self.accounts_by_client.get(client_id)
