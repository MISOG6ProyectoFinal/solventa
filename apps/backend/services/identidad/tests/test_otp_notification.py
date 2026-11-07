"""El OTP del consentimiento sale por el proveedor de notificaciones (servicio simuladores mientras no hay real)."""

from datetime import UTC, datetime

import httpx
import pytest
from fastapi.testclient import TestClient
from identidad.kyc.adapters.notificaciones import OTP_TEMPLATE, NotificationOtpSender
from identidad.kyc.domain.models import NotificationUnavailable
from identidad.main import app

client = TestClient(app)

SOLICITUD = {
    "tipo_documento": "CC",
    "numero_documento": "1098700942",
    "nombre": "Lina Díaz",
    "canal": "sms",
    "contacto": "3001234567",
    "asesor": "Ana Gómez (asesor)",
}
VENCE = datetime(2026, 11, 5, 15, 30, tzinfo=UTC)


class _Adapter:
    def __init__(self, response=None, error: Exception | None = None) -> None:
        self.response = {"status": "sent"} if response is None else response
        self.error = error
        self.calls: list[tuple] = []

    def notify(self, channel, recipient, template, data):
        self.calls.append((channel, recipient, template, data))
        if self.error:
            raise self.error
        return self.response


def test_the_code_is_sent_to_the_customer_contact(otp_sender):
    response = client.post("/identidad/solicitar", json=SOLICITUD)

    assert response.status_code == 201
    assert otp_sender.sent == [
        {
            "channel": "sms",
            "recipient": "3001234567",
            "code": response.json()["codigo_demo"],
            "expires_at": datetime.fromisoformat(response.json()["expira_en"]),
        }
    ]


def test_without_notifications_there_is_no_consent_request(otp_sender):
    otp_sender.error = NotificationUnavailable("No se pudo enviar el código de verificación")

    response = client.post("/identidad/solicitar", json=SOLICITUD)

    assert response.status_code == 503
    assert response.json()["detail"] == {
        "codigo": "notificacion_no_disponible",
        "mensaje": "No se pudo enviar el código de verificación",
    }


def test_sender_uses_the_otp_template():
    adapter = _Adapter()

    NotificationOtpSender(adapter).send("sms", "3001234567", "123456", VENCE)

    assert adapter.calls == [("sms", "3001234567", OTP_TEMPLATE, {"codigo": "123456", "vence": VENCE.isoformat()})]


@pytest.mark.parametrize(
    "adapter",
    [_Adapter(error=httpx.ConnectError("caido")), _Adapter(response={"aceptada": "quizas"}), _Adapter(response=[])],
)
def test_provider_failure_or_unknown_answer_is_unavailable(adapter):
    with pytest.raises(NotificationUnavailable):
        NotificationOtpSender(adapter).send("correo", "lina@test.co", "123456", VENCE)
