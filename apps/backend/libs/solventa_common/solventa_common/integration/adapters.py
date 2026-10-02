"""Adaptadores por tercero del modelo de componentes (capa de integración).

Los contratos de cada proveedor aún no están definidos; los métodos marcan la
operación que consume Solventa y el presupuesto de latencia que le corresponde.
"""

from typing import Any

from solventa_common.integration.base import ExternalAdapter


class OpenFinanceAdapter(ExternalAdapter):
    """Consentimiento y datos financieros. Timeout 700 ms (ASR-01)."""

    name = "open-finance"
    timeout_s = 0.7

    def get_financial_profile(self, customer_id: str, consent_id: str) -> Any:
        return self._request("GET", f"/customers/{customer_id}/profile", params={"consent": consent_id})


class OpenDataAdapter(ExternalAdapter):
    """Clima, geolocalización y listas oficiales; fuente de eventos paramétricos."""

    name = "open-data"
    timeout_s = 0.3

    def get_observation(self, source: str, location: str) -> Any:
        return self._request("GET", f"/observations/{source}", params={"location": location})


class KycAmlAdapter(ExternalAdapter):
    """Verificación de identidad y listas restrictivas."""

    name = "kyc-aml"
    timeout_s = 3.0

    def verify(self, document_type: str, document_number: str) -> Any:
        return self._request("POST", "/verifications", json={"type": document_type, "number": document_number})


class PasarelaPagosAdapter(ExternalAdapter):
    """PCI-DSS, idempotencia y conciliación. La clave de idempotencia viaja al proveedor."""

    name = "pasarela-pagos"
    timeout_s = 3.0
    retries = 0  # Un cobro no se reintenta a ciegas; se reconcilia por clave de idempotencia.

    def charge(self, amount: float, currency: str, token: str, idempotency_key: str) -> Any:
        return self._request(
            "POST",
            "/charges",
            json={"amount": amount, "currency": currency, "token": token},
            headers={"Idempotency-Key": idempotency_key},
        )


class AcordReaseguroAdapter(ExternalAdapter):
    """Mapeo semántico y versionado de esquemas ACORD hacia reaseguradores."""

    name = "acord-reaseguro"

    def cede(self, cession: dict) -> Any:
        return self._request("POST", "/cessions", json=cession)


class FirmaNotificacionAdapter(ExternalAdapter):
    """Firma electrónica y notificaciones push/SMS/correo. No repudio y trazabilidad."""

    name = "firma-notificacion"

    def sign(self, document_url: str, signer_id: str) -> Any:
        return self._request("POST", "/signatures", json={"document_url": document_url, "signer": signer_id})

    def notify(self, channel: str, recipient: str, template: str, data: dict) -> Any:
        return self._request(
            "POST", "/notifications", json={"channel": channel, "to": recipient, "template": template, "data": data}
        )
