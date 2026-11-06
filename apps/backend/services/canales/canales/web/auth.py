from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from solventa_common.operator_session import OperatorToken, verify_operator_token
from solventa_common.sesion import InvalidToken

from canales.config import settings

INVALID_SESSION = {"codigo": "sesion_invalida", "mensaje": "Inicia sesión para continuar."}
PERMISSION_DENIED = {"codigo": "permiso_denegado", "mensaje": "Tu rol no permite esta operación."}


def _bearer(authorization: str | None) -> str:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)
    return token


def require_operator(authorization: Annotated[str | None, Header()] = None) -> OperatorToken:
    """Operador del portal con un token vigente emitido por Identidad."""
    try:
        return verify_operator_token(_bearer(authorization), settings.sesion_secreto)
    except InvalidToken as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION) from exc


Operator = Annotated[OperatorToken, Depends(require_operator)]


def require_roles(*roles: str):
    """Dependencia que deja pasar solo a operadores con alguno de los roles."""

    def dependency(operator: Operator) -> OperatorToken:
        if not operator.has_any(*roles):
            raise HTTPException(status.HTTP_403_FORBIDDEN, PERMISSION_DENIED)
        return operator

    return dependency
