"""Envío del OTP por el proveedor de notificaciones (SMS o correo)."""

from datetime import datetime

from solventa_common.integration import FirmaNotificacionAdapter

from identidad.kyc.domain.models import NotificationUnavailable

OTP_TEMPLATE = "otp-consentimiento"


class NotificationOtpSender:
    def __init__(self, adapter: FirmaNotificacionAdapter) -> None:
        self.adapter = adapter

    def send(self, channel: str, recipient: str, code: str, expires_at: datetime) -> None:
        try:
            sent = self.adapter.notify(
                channel, recipient, OTP_TEMPLATE, {"codigo": code, "vence": expires_at.isoformat()}
            )
        except Exception as exc:
            raise NotificationUnavailable("No se pudo enviar el código de verificación") from exc
        if not isinstance(sent, dict) or sent.get("status") != "sent":
            raise NotificationUnavailable("El proveedor de notificaciones no confirmó el envío")
