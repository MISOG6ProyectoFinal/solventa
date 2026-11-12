"""Constantes, eventos pendientes y reglas que comparten los casos de uso de Pólizas."""

import logging
from datetime import UTC, date, datetime

from solventa_common.cobros import MONEDA_COP, EstadoCobro
from solventa_common.events import EventPublisher

from polizas.ciclo_vida.domain.models import (
    Policy,
    PolicyStatus,
    Validity,
)
from polizas.ciclo_vida.domain.ports import (
    PolicyRepository,
)

POLIZA_RENOVADA = "poliza.renovada"


POLIZA_ENDOSADA = "poliza.endosada"


POLIZA_CANCELADA = "poliza.cancelada"


SOURCE = "polizas"


MONEDA = MONEDA_COP


APPROVED = EstadoCobro.APROBADO


logger = logging.getLogger(__name__)


def _today() -> date:
    return datetime.now(UTC).date()


def with_effective_status(policy: Policy, today: date) -> Policy:
    """Una póliza activa cuya vigencia ya terminó se muestra como VENCIDA."""
    if policy.estado is PolicyStatus.ACTIVE and policy.vigencia.hasta < today:
        return policy.model_copy(update={"estado": PolicyStatus.EXPIRED})
    return policy


def publish_pending(policies: PolicyRepository, publisher: EventPublisher) -> int:
    """Publica los eventos ya confirmados en la base. Un fallo deja el evento pendiente."""
    published = 0
    for event in policies.pending_events():
        try:
            publisher.publish(event)
        except Exception:
            logger.exception("No se pudo publicar el evento %s", event.event_id)
            continue
        policies.mark_published(event.event_id)
        published += 1
    return published


def _periodo(vigencia: Validity) -> dict[str, str]:
    return {"desde": vigencia.desde.isoformat(), "hasta": vigencia.hasta.isoformat()}


def _payment_approved(payment: dict | None) -> bool:
    return payment is not None and payment.get("estado") == APPROVED
