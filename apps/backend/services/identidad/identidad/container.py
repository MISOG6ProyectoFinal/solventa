from solventa_common.integration import FirmaNotificacionAdapter
from sqlalchemy.engine import Engine

from identidad.config import settings
from identidad.kyc.adapters.account_repository import InMemoryAccountRepository, PostgresAccountRepository
from identidad.kyc.adapters.consentimiento_repository import (
    InMemoryConsentimientoRepository,
    PostgresConsentimientoRepository,
)
from identidad.kyc.adapters.notificaciones import NotificationOtpSender
from identidad.kyc.adapters.repository import InMemoryClientRepository, PostgresClientRepository
from identidad.kyc.domain.use_cases import (
    AsegurarCliente,
    BuscarClientePorDocumento,
    ConsultarConsentimiento,
    GetClient,
    RegisterClient,
    SolicitarConsentimiento,
    StartSession,
    ValidarConsentimiento,
)
from identidad.operadores.adapters.repository import InMemoryOperatorRepository, PostgresOperatorRepository
from identidad.operadores.domain.use_cases import (
    CreateOperator,
    ListOperators,
    StartOperatorSession,
    UpdateOperator,
    seed_admin,
)


class Container:
    def __init__(self) -> None:
        self.secret = settings.sesion_secreto
        self.otp_sender = NotificationOtpSender(
            FirmaNotificacionAdapter(settings.firma_notificacion_url, settings.firma_notificacion_api_key)
        )
        self.use_memory()

    def use_memory(self) -> None:
        self.clients = InMemoryClientRepository()
        self.accounts = InMemoryAccountRepository()
        self.consentimientos = InMemoryConsentimientoRepository()
        self.operators = InMemoryOperatorRepository()
        self._wire()
        self._seed_admin()

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

        operator_repo = PostgresOperatorRepository(engine)
        operator_repo.create_schema()
        self.operators = operator_repo

        self._wire()
        self._seed_admin()

    def _seed_admin(self) -> None:
        seed_admin(
            self.operators,
            settings.operador_admin_correo,
            settings.operador_admin_nombre,
            settings.operador_admin_contrasena,
        )

    def _wire(self) -> None:
        self.start_session = StartSession(self.clients, self.accounts, self.secret)
        self.register_client = RegisterClient(self.clients, self.accounts, self.secret)
        self.solicitar_consentimiento = SolicitarConsentimiento(self.consentimientos, self.otp_sender, self.clients)
        self.validar_consentimiento = ValidarConsentimiento(self.consentimientos)
        self.consultar_consentimiento = ConsultarConsentimiento(self.consentimientos, self.clients)
        self.buscar_cliente_por_documento = BuscarClientePorDocumento(self.clients)
        self.asegurar_cliente = AsegurarCliente(self.clients)
        self.get_client = GetClient(self.clients)
        self.start_operator_session = StartOperatorSession(self.operators, self.secret)
        self.create_operator = CreateOperator(self.operators)
        self.list_operators = ListOperators(self.operators)
        self.update_operator = UpdateOperator(self.operators)


container = Container()
