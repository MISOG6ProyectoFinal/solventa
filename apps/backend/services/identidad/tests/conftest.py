import os

import pytest

# Unit tests do not read the local .env. The value is only a fixture.
os.environ.setdefault("SESION_SECRETO", "test-sesion-secreto")


class RecordingOtpSender:
    """Mock en código del proveedor de notificaciones: guarda lo que se habría enviado."""

    def __init__(self) -> None:
        self.sent: list[dict] = []
        self.error: Exception | None = None

    def send(self, channel, recipient, code, expires_at) -> None:
        if self.error:
            raise self.error
        self.sent.append({"channel": channel, "recipient": recipient, "code": code, "expires_at": expires_at})


@pytest.fixture(autouse=True)
def otp_sender():
    from identidad.container import container

    original = container.otp_sender
    container.otp_sender = RecordingOtpSender()
    container._wire()
    yield container.otp_sender
    container.otp_sender = original
    container._wire()
