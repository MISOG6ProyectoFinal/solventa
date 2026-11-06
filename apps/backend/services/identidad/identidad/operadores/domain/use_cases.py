from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from solventa_common.operator_session import ADMIN, sign_operator_token

from identidad.kyc.domain.sesion import hash_password, new_salt, password_matches
from identidad.operadores.domain.models import (
    EmailTaken,
    InvalidOperatorCredentials,
    NewOperator,
    Operator,
    OperatorNotFound,
    OperatorSession,
    OperatorUpdate,
    OperatorView,
)
from identidad.operadores.domain.ports import OperatorRepository

SESSION_HOURS = 8
_DUMMY_SALT = "00" * 16
_DUMMY_HASH = hash_password("not-an-operator-password", _DUMMY_SALT)


def _utc_now() -> datetime:
    return datetime.now(UTC)


class StartOperatorSession:
    def __init__(
        self,
        operators: OperatorRepository,
        secret: str,
        ttl: timedelta = timedelta(hours=SESSION_HOURS),
        now: Callable[[], datetime] = _utc_now,
    ) -> None:
        self.operators = operators
        self.secret = secret
        self.ttl = ttl
        self.now = now

    def execute(self, email: str, password: str) -> OperatorSession:
        operator = self.operators.get_by_email(email.lower())
        if operator is None or not operator.activo:
            password_matches(password, _DUMMY_HASH, _DUMMY_SALT)
            raise InvalidOperatorCredentials
        if not password_matches(password, operator.password_hash, operator.salt):
            raise InvalidOperatorCredentials
        token = sign_operator_token(
            operator.id,
            operator.correo,
            operator.nombre,
            operator.roles,
            self.secret,
            expires_at=self.now() + self.ttl,
        )
        return OperatorSession(token=token, operador=operator.to_view())


def _build_operator(email: str, name: str, roles: list[str], password: str, now: datetime) -> Operator:
    salt = new_salt()
    return Operator(
        id=str(uuid4()),
        correo=email.lower(),
        nombre=name,
        roles=roles,
        password_hash=hash_password(password, salt),
        salt=salt,
        creado_en=now,
    )


class CreateOperator:
    def __init__(self, operators: OperatorRepository, now: Callable[[], datetime] = _utc_now) -> None:
        self.operators = operators
        self.now = now

    def execute(self, request: NewOperator) -> OperatorView:
        if self.operators.get_by_email(request.correo) is not None:
            raise EmailTaken(request.correo)
        operator = _build_operator(request.correo, request.nombre, request.roles, request.contrasena, self.now())
        self.operators.add(operator)
        return operator.to_view()


class ListOperators:
    def __init__(self, operators: OperatorRepository) -> None:
        self.operators = operators

    def execute(self) -> list[OperatorView]:
        return [operator.to_view() for operator in self.operators.list()]


class UpdateOperator:
    def __init__(self, operators: OperatorRepository) -> None:
        self.operators = operators

    def execute(self, operator_id: str, changes: OperatorUpdate) -> OperatorView:
        operator = self.operators.get(operator_id)
        if operator is None:
            raise OperatorNotFound(operator_id)
        if changes.roles is not None:
            operator.roles = changes.roles
        if changes.activo is not None:
            operator.activo = changes.activo
        self.operators.update(operator)
        return operator.to_view()


def seed_admin(operators: OperatorRepository, email: str | None, name: str, password: str | None) -> None:
    """Crea el primer administrador una sola vez; sin correo y contraseña no hace nada."""
    if not email or not password:
        return
    if operators.get_by_email(email.lower()) is not None:
        return
    admin = _build_operator(email, name, [ADMIN], password, _utc_now())
    try:
        operators.add(admin)
    except EmailTaken:
        return
