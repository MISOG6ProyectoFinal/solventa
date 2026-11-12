from datetime import UTC, datetime

from pydantic import BaseModel, field_validator
from solventa_common.operator_session import ROLES

from identidad.kyc.domain.models import EMAIL_PATTERN, check_password


def _valid_roles(roles: list[str]) -> list[str]:
    if not roles:
        raise ValueError("Debe asignar al menos un rol.")
    if any(role not in ROLES for role in roles):
        raise ValueError(f"Los roles válidos son: {', '.join(ROLES)}.")
    if len(set(roles)) != len(roles):
        raise ValueError("Los roles no pueden repetirse.")
    return roles


class Operator(BaseModel):
    id: str
    correo: str
    nombre: str
    roles: list[str]
    password_hash: str
    salt: str
    activo: bool = True
    creado_en: datetime

    @field_validator("correo")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("creado_en")
    @classmethod
    def _utc(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    def to_view(self) -> "OperatorView":
        return OperatorView(
            id=self.id,
            correo=self.correo,
            nombre=self.nombre,
            roles=list(self.roles),
            activo=self.activo,
            creado_en=self.creado_en,
        )


class OperatorLogin(BaseModel):
    correo: str
    contrasena: str

    @field_validator("correo")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class NewOperator(BaseModel):
    correo: str
    nombre: str
    roles: list[str]
    contrasena: str

    @field_validator("correo")
    @classmethod
    def _email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_PATTERN.match(value):
            raise ValueError("El correo no tiene un formato válido.")
        return value

    @field_validator("nombre")
    @classmethod
    def _name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("El nombre es obligatorio.")
        return value

    @field_validator("roles")
    @classmethod
    def _roles(cls, value: list[str]) -> list[str]:
        return _valid_roles(value)

    @field_validator("contrasena")
    @classmethod
    def _password(cls, value: str) -> str:
        return check_password(value)


class OperatorUpdate(BaseModel):
    roles: list[str] | None = None
    activo: bool | None = None

    @field_validator("roles")
    @classmethod
    def _roles(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _valid_roles(value)


class OperatorView(BaseModel):
    id: str
    correo: str
    nombre: str
    roles: list[str]
    activo: bool
    creado_en: datetime


class OperatorSession(BaseModel):
    token: str
    operador: OperatorView


class OperatorNotFound(Exception):
    pass


class EmailTaken(Exception):
    pass


class InvalidOperatorCredentials(Exception):
    pass
