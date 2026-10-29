from sqlalchemy.engine import Engine

from identidad.config import settings
from identidad.kyc.adapters.account_repository import InMemoryAccountRepository, PostgresAccountRepository
from identidad.kyc.adapters.consentimiento_repository import (
    InMemoryConsentimientoRepository,
    PostgresConsentimientoRepository,
)
from identidad.kyc.adapters.repository import InMemoryClientRepository, PostgresClientRepository
from identidad.kyc.domain.use_cases import (
    AsegurarCliente,
    BuscarClientePorDocumento,
    ConsultarConsentimiento,
    RegisterClient,
    SolicitarConsentimiento,
    StartSession,
    ValidarConsentimiento,
)


class Container:
    def __init__(self) -> None:
        self.secret = settings.sesion_secreto
        self.use_memory()

    def use_memory(self) -> None:
        self.clients = InMemoryClientRepository()
        self.accounts = InMemoryAccountRepository()
        self.consentimientos = InMemoryConsentimientoRepository()
        self._wire()

    def use_postgres(self, engine: Engine) -> None:
        client_repo = PostgresClientRepository(engine)
        client_repo.create_schema()
        self.clients = client_repo

        account_repo = PostgresAccountRepository(engine)
        account_repo.create_schema()
        self.accounts = account_repo

        consent_repo = PostgresConsentimientoRepository(engine)
        consent_repo.create_schema()
        self.consentimientos = consent_repo

        self._wire()

    def _wire(self) -> None:
        self.start_session = StartSession(self.clients, self.accounts, self.secret)
        self.register_client = RegisterClient(self.clients, self.accounts, self.secret)
        self.solicitar_consentimiento = SolicitarConsentimiento(self.consentimientos, self.clients)
        self.validar_consentimiento = ValidarConsentimiento(self.consentimientos)
        self.consultar_consentimiento = ConsultarConsentimiento(self.consentimientos, self.clients)
        self.buscar_cliente_por_documento = BuscarClientePorDocumento(self.clients)
        self.asegurar_cliente = AsegurarCliente(self.clients)


container = Container()
