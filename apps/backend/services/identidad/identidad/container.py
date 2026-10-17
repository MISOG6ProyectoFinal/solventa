from sqlalchemy.engine import Engine

from identidad.config import settings
from identidad.kyc.adapters.repository import InMemoryClientRepository, PostgresClientRepository
from identidad.kyc.domain.use_cases import RegisterClient, StartSession


class Container:
    def __init__(self) -> None:
        self.secret = settings.sesion_secreto
        self.use_memory()

    def use_memory(self) -> None:
        self.clients = InMemoryClientRepository()
        self._wire()

    def use_postgres(self, engine: Engine) -> None:
        repository = PostgresClientRepository(engine)
        repository.create_schema()
        self.clients = repository
        self._wire()

    def _wire(self) -> None:
        self.start_session = StartSession(self.clients, self.secret)
        self.register_client = RegisterClient(self.clients, self.secret)


container = Container()
