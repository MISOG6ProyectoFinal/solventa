from datetime import UTC, datetime, timedelta

from canales.config import settings
from solventa_common.sesion import sign_token


def authorization() -> dict[str, str]:
    token = sign_token(
        "cliente-demo",
        "cliente@solventa.test",
        settings.sesion_secreto,
        first_name="Ana",
        last_name="Rojas",
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    return {"Authorization": f"Bearer {token}"}
