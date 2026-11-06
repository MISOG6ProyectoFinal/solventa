"""APIs de los terceros con el mismo contrato que consumen los adaptadores de solventa_common."""

import hashlib
import secrets
from datetime import UTC, datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Header, status
from pydantic import BaseModel, Field

from simuladores.control import PROVIDERS, Mode

APPROVED_TOKEN = "demo-4242"

open_finance = APIRouter(prefix="/open-finance", tags=["Open Finance simulado"])
payment_gateway = APIRouter(prefix="/pasarela-pagos", tags=["Pasarela de pagos simulada"])
notifications = APIRouter(prefix="/notificaciones", tags=["Notificaciones simuladas"])
assistance_network = APIRouter(prefix="/red-asistencia", tags=["Red de asistencia simulada"])
outbox_view = APIRouter(prefix="/simuladores/notificaciones", tags=["Control de simuladores"])


def risk_score(customer_id: str) -> str:
    """El mismo cliente siempre recibe el mismo score entre 0.30 y 0.70."""
    digest = hashlib.sha256(customer_id.encode()).digest()
    return f"{(30 + digest[0] % 41) / 100:.2f}"


@open_finance.get("/customers/{customer_id}/profile")
async def financial_profile(customer_id: str, consent: str | None = None) -> dict:
    if await PROVIDERS["open-finance"].respond() == Mode.INVALID:
        return {"perfil": "sin score"}
    return {"cliente": customer_id, "consentimiento": consent, "score_riesgo": risk_score(customer_id)}


class Charge(BaseModel):
    amount: float
    currency: str
    token: str


charges: dict[str, dict] = {}


@payment_gateway.post("/charges")
async def charge(cobro: Charge, idempotency_key: Annotated[str, Header()]) -> dict:
    """Aprueba solo el token demo-4242. La misma clave de idempotencia devuelve el mismo resultado."""
    if await PROVIDERS["pasarela-pagos"].respond() == Mode.INVALID:
        return {"resultado": "desconocido"}
    if idempotency_key not in charges:
        approved = cobro.token == APPROVED_TOKEN
        charges[idempotency_key] = {
            "status": "approved" if approved else "rejected",
            "referencia": idempotency_key,
            "amount": cobro.amount,
            "currency": cobro.currency,
        }
    return charges[idempotency_key]


class Notification(BaseModel):
    channel: str
    to: str
    template: str
    data: dict = Field(default_factory=dict)


outbox: list[dict] = []


@notifications.post("/notifications", status_code=status.HTTP_202_ACCEPTED)
async def notify(notificacion: Notification) -> dict:
    if await PROVIDERS["notificaciones"].respond() == Mode.INVALID:
        return {"aceptada": "quizas"}
    sent = {
        "id": str(uuid4()),
        "status": "sent",
        "enviada_en": datetime.now(UTC).isoformat(),
        **notificacion.model_dump(),
    }
    outbox.append(sent)
    return sent


@outbox_view.get("/mensajes")
def sent_messages(to: str | None = None) -> list[dict]:
    """Bandeja de lo enviado, la más reciente primero, para leer un OTP en la demo."""
    return [message for message in reversed(outbox) if to is None or message["to"] == to]


ARRIVAL_MINUTES = {"grua": (25, 40), "ambulancia": (10, 20), "perito": (25, 40)}


class Dispatch(BaseModel):
    servicio: str
    ubicacion: str
    gps: str | None = None


@assistance_network.post("/despachos")
async def dispatch(despacho: Dispatch) -> dict:
    """Asigna un número de solicitud y el tiempo estimado de llegada del servicio."""
    if await PROVIDERS["red-asistencia"].respond() == Mode.INVALID:
        return {"despacho": "pendiente"}
    eta_min, eta_max = ARRIVAL_MINUTES.get(despacho.servicio, (30, 60))
    return {"numero": f"AST-{1000 + secrets.randbelow(9000)}", "eta_min": eta_min, "eta_max": eta_max}
