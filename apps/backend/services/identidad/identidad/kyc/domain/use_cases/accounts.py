"""Cuenta del cliente: registro con contraseña y sesión."""

from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from solventa_common.sesion import sign_token

from identidad.kyc.domain.models import (
    Account,
    Client,
    DocumentAlreadyRegistered,
    EmailAlreadyRegistered,
    InvalidCredentials,
    Session,
)
from identidad.kyc.domain.ports import AccountRepository, ClientRepository
from identidad.kyc.domain.sesion import hash_password, new_salt, password_matches

SESSION_DAYS = 7


_DUMMY_SALT = "00" * 16


_DUMMY_HASH = hash_password("not-a-client-password", _DUMMY_SALT)


def issue_session(client: Client, secret: str) -> Session:
    expires_at = datetime.now(UTC) + timedelta(days=SESSION_DAYS)
    token = sign_token(
        client.id,
        client.email,
        secret,
        first_name=client.first_name,
        last_name=client.last_name,
        expires_at=expires_at,
    )
    return Session(token=token, client_id=client.id)


class StartSession:
    def __init__(self, clients: ClientRepository, accounts: AccountRepository, secret: str) -> None:
        self.clients = clients
        self.accounts = accounts
        self.secret = secret

    def execute(self, email: str, password: str) -> Session:
        client = self.clients.get_by_email(email.lower())
        account = self.accounts.get(client.id) if client else None
        # A missing account still runs the slow check, so the response time does not reveal which case it was.
        if client is None or account is None:
            password_matches(password, _DUMMY_HASH, _DUMMY_SALT)
            raise InvalidCredentials
        if not password_matches(password, account.password_hash, account.salt):
            raise InvalidCredentials
        return issue_session(client, self.secret)


class RegisterClient:
    def __init__(self, clients: ClientRepository, accounts: AccountRepository, secret: str) -> None:
        self.clients = clients
        self.accounts = accounts
        self.secret = secret

    def execute(
        self,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        *,
        tipo_documento: str,
        numero_documento: str,
        telefono: str,
        fecha_nacimiento: date,
    ) -> Session:
        normalized = email.lower()
        by_email = self.clients.get_by_email(normalized)
        by_numero = self.clients.get_by_numero_documento(numero_documento)
        if by_email is not None and self.accounts.get(by_email.id) is not None:
            raise EmailAlreadyRegistered
        if by_numero is not None and self.accounts.get(by_numero.id) is not None:
            raise DocumentAlreadyRegistered
        # A client from consent is linked only when the email and the document both point to it.
        if by_numero is not None and (by_email is None or by_email.id != by_numero.id):
            raise DocumentAlreadyRegistered
        if by_email is not None and by_email.numero_documento not in ("", numero_documento):
            raise EmailAlreadyRegistered

        if by_email is None:
            client = Client(
                id=str(uuid4()),
                email=normalized,
                first_name=first_name,
                last_name=last_name,
                tipo_documento=tipo_documento,
                numero_documento=numero_documento,
                telefono=telefono,
                fecha_nacimiento=fecha_nacimiento,
            )
            try:
                self.clients.add(client)
            except ValueError as exc:
                raise EmailAlreadyRegistered from exc
        else:
            client = by_email
            client.tipo_documento = tipo_documento
            client.numero_documento = numero_documento
            client.telefono = client.telefono or telefono
            client.fecha_nacimiento = client.fecha_nacimiento or fecha_nacimiento
            self.clients.update(client)

        salt = new_salt()
        self.accounts.add(Account(client_id=client.id, password_hash=hash_password(password, salt), salt=salt))
        return issue_session(client, self.secret)
