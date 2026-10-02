import logging

from solventa_common.events import Event

logger = logging.getLogger(__name__)


def handle(event: Event) -> None:
    # TODO: reacción de Notificaciones a cada evento de integración.
    logger.info("notificaciones: %s %s", event.event_type, event.event_id)
