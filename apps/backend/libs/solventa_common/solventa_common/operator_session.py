"""Token del operador del portal. Identidad lo emite y el BFF Web lo verifica sin leer la base de datos.

Usa la misma firma del token del móvil, pero con audiencia `portal`: un token de cliente no abre el portal
ni uno de operador abre la app.
"""

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime

from solventa_common.sesion import InvalidToken, _decode, _encode

AUDIENCE = "portal"
ADMIN = "administrador"
ADVISOR = "asesor"
VIEWER = "consulta"
ROLES = (ADMIN, ADVISOR, VIEWER)


@dataclass(frozen=True)
class OperatorToken:
    operator_id: str
    email: str
    name: str
    roles: tuple[str, ...]

    def has_any(self, *roles: str) -> bool:
        return any(role in self.roles for role in roles)


def sign_operator_token(
    operator_id: str, email: str, name: str, roles: tuple[str, ...] | list[str], secret: str, *, expires_at: datetime
) -> str:
    payload = json.dumps(
        {
            "aud": AUDIENCE,
            "sub": operator_id,
            "correo": email,
            "nombre": name,
            "roles": list(roles),
            "exp": int(expires_at.timestamp()),
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    body = _encode(payload)
    signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_encode(signature)}"


def verify_operator_token(token: str, secret: str, *, now: datetime | None = None) -> OperatorToken:
    now = now or datetime.now(UTC)
    parts = token.split(".")
    if len(parts) != 2:
        raise InvalidToken
    body, signature = parts
    expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _decode(signature)):
        raise InvalidToken
    try:
        payload = json.loads(_decode(body))
        audience, operator_id, email, name = payload["aud"], payload["sub"], payload["correo"], payload["nombre"]
        roles, expires = payload["roles"], int(payload["exp"])
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidToken from exc
    valid = (
        audience == AUDIENCE
        and expires > int(now.timestamp())
        and all(isinstance(value, str) for value in (operator_id, email, name))
        and isinstance(roles, list)
        and all(role in ROLES for role in roles)
    )
    if not valid:
        raise InvalidToken
    return OperatorToken(operator_id=operator_id, email=email, name=name, roles=tuple(roles))
