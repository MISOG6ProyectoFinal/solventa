from datetime import UTC, datetime, timedelta

from canales.config import settings
from solventa_common.operator_session import ADMIN, ADVISOR, VIEWER, sign_operator_token

OPERATOR_NAME = "Laura Operadora"


def token(*roles: str, expires_at: datetime | None = None, name: str = OPERATOR_NAME) -> str:
    return sign_operator_token(
        "op-1",
        "operador@solventa.test",
        name,
        roles,
        settings.sesion_secreto,
        expires_at=expires_at or datetime.now(UTC) + timedelta(hours=8),
    )


def authorization(*roles: str, name: str = OPERATOR_NAME) -> dict[str, str]:
    return {"Authorization": f"Bearer {token(*roles, name=name)}"}


def admin() -> dict[str, str]:
    return authorization(ADMIN)


def advisor() -> dict[str, str]:
    return authorization(ADVISOR)


def viewer() -> dict[str, str]:
    return authorization(VIEWER)
