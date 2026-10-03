import logging

from solventa_common.events import Event

logger = logging.getLogger(__name__)


def handle(event: Event) -> None:
    # TODO: reacción de Auditoría y Linaje del Dato a cada evento de integración.
    logger.info("linaje: %s %s", event.event_type, event.event_id)
