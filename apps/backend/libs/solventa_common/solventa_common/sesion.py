"""Signed session token. Identidad issues it and the BFF checks it without reading the database."""

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime


class InvalidToken(Exception):
    pass


@dataclass(frozen=True)
class SessionToken:
    client_id: str
    email: str
    first_name: str
    last_name: str


def _encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    try:
        return base64.urlsafe_b64decode(value + padding)
    except ValueError as exc:
        raise InvalidToken from exc


def sign_token(
    client_id: str,
    email: str,
    secret: str,
    *,
    first_name: str,
    last_name: str,
    expires_at: datetime,
) -> str:
    payload = json.dumps(
        {
            "cliente_id": client_id,
            "correo": email,
            "nombre": first_name,
            "apellido": last_name,
            "exp": int(expires_at.timestamp()),
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    body = _encode(payload)
    signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_encode(signature)}"


def verify_token(token: str, secret: str, *, now: datetime | None = None) -> SessionToken:
    now = now or datetime.now(UTC)
    parts = token.split(".")
    if len(parts) != 2:
        raise InvalidToken
    body, signature = parts
    expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()
    try:
        actual = _decode(signature)
        matches = hmac.compare_digest(expected, actual)
    except (InvalidToken, TypeError) as exc:
        raise InvalidToken from exc
    if not matches:
        raise InvalidToken
    try:
        payload = json.loads(_decode(body))
        client_id = payload["cliente_id"]
        email = payload["correo"]
        first_name = payload["nombre"]
        last_name = payload["apellido"]
        expires = int(payload["exp"])
    except (InvalidToken, KeyError, TypeError, ValueError) as exc:
        raise InvalidToken from exc
    if (
        expires <= int(now.timestamp())
        or not isinstance(client_id, str)
        or not isinstance(email, str)
        or not isinstance(first_name, str)
        or not isinstance(last_name, str)
    ):
        raise InvalidToken
    return SessionToken(client_id=client_id, email=email, first_name=first_name, last_name=last_name)
