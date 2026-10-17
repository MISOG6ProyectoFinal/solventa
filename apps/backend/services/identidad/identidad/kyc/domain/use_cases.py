from datetime import UTC, datetime, timedelta
from uuid import uuid4

from solventa_common.sesion import sign_token

from identidad.kyc.domain.models import Client, EmailAlreadyRegistered, InvalidCredentials, Session
from identidad.kyc.domain.ports import ClientRepository
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
    def __init__(self, clients: ClientRepository, secret: str) -> None:
        self.clients = clients
        self.secret = secret

    def execute(self, email: str, password: str) -> Session:
        client = self.clients.get_by_email(email.lower())
        # A missing account still runs the slow check, so the response time does not reveal which case it was.
        if client is None:
            password_matches(password, _DUMMY_HASH, _DUMMY_SALT)
            raise InvalidCredentials
        if not password_matches(password, client.password_hash, client.salt):
            raise InvalidCredentials
        return issue_session(client, self.secret)


class RegisterClient:
    def __init__(self, clients: ClientRepository, secret: str) -> None:
        self.clients = clients
        self.secret = secret

    def execute(self, email: str, password: str, first_name: str, last_name: str) -> Session:
        normalized = email.lower()
        if self.clients.get_by_email(normalized) is not None:
            raise EmailAlreadyRegistered
        salt = new_salt()
        client = Client(
            id=str(uuid4()),
            email=normalized,
            first_name=first_name,
            last_name=last_name,
            password_hash=hash_password(password, salt),
            salt=salt,
        )
        try:
            self.clients.add(client)
        except ValueError as exc:
            raise EmailAlreadyRegistered from exc
        return issue_session(client, self.secret)
