from solventa_common.events import EventPublisher, InMemoryEventPublisher, SnsEventPublisher

from siniestro_parametrico.config import settings


def build_publisher() -> EventPublisher:
    if settings.events_topic_arn:
        return SnsEventPublisher(settings.events_topic_arn, settings.aws_region, settings.aws_endpoint_url)
    return InMemoryEventPublisher()
