import logging

from solventa_common.events import Event

logger = logging.getLogger(__name__)


def handle(event: Event) -> None:
    # TODO: reacción de Analítica, Fraude y Cumplimiento a cada evento de integración.
    logger.info("analitica: %s %s", event.event_type, event.event_id)
