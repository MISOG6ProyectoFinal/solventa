import logging

from solventa_common.events import Event

logger = logging.getLogger(__name__)


def handle(event: Event) -> None:
    logger.info("analitica: %s %s", event.event_type, event.event_id)
