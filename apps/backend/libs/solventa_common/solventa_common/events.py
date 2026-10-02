"""Bus de eventos: publicación en SNS y consumo desde SQS (entrega al menos una vez).

La Dead Letter Queue no se maneja en código: cada cola SQS tiene una redrive policy
con maxReceiveCount = 3 (deploy/terraform/modules/event_bus). Si el handler falla,
el mensaje no se borra, vuelve a ser visible y tras el tercer intento pasa a la DLQ.
"""

import json
import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, Protocol

import boto3
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class Event(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    source: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    idempotency_key: str
    payload: dict[str, Any] = Field(default_factory=dict)


class EventPublisher(Protocol):
    def publish(self, event: Event) -> None: ...


class SnsEventPublisher:
    def __init__(self, topic_arn: str, region: str, endpoint_url: str | None = None) -> None:
        self.topic_arn = topic_arn
        self.client = boto3.client("sns", region_name=region, endpoint_url=endpoint_url)

    def publish(self, event: Event) -> None:
        self.client.publish(
            TopicArn=self.topic_arn,
            Message=event.model_dump_json(),
            # Los suscriptores filtran por tipo con una filter policy de SNS.
            MessageAttributes={"event_type": {"DataType": "String", "StringValue": event.event_type}},
        )


class InMemoryEventPublisher:
    """Publicador para pruebas y desarrollo sin AWS."""

    def __init__(self) -> None:
        self.events: list[Event] = []

    def publish(self, event: Event) -> None:
        self.events.append(event)


def parse_sqs_body(body: str) -> Event:
    """Acepta el cuerpo directo o el sobre de SNS (cuando no se usa raw message delivery)."""
    data = json.loads(body)
    if "Message" in data and "TopicArn" in data:
        data = json.loads(data["Message"])
    return Event.model_validate(data)


class SqsEventConsumer:
    """Competing Consumer: cada réplica hace long-polling y toma el siguiente mensaje libre."""

    def __init__(
        self,
        queue_url: str,
        handler: Callable[[Event], None],
        region: str,
        endpoint_url: str | None = None,
        batch_size: int = 10,
        wait_seconds: int = 20,
    ) -> None:
        self.queue_url = queue_url
        self.handler = handler
        self.batch_size = batch_size
        self.wait_seconds = wait_seconds
        self.client = boto3.client("sqs", region_name=region, endpoint_url=endpoint_url)
        self._running = True

    def stop(self) -> None:
        self._running = False

    def poll_once(self) -> int:
        response = self.client.receive_message(
            QueueUrl=self.queue_url,
            MaxNumberOfMessages=self.batch_size,
            WaitTimeSeconds=self.wait_seconds,
        )
        processed = 0
        for message in response.get("Messages", []):
            try:
                self.handler(parse_sqs_body(message["Body"]))
            except Exception:
                logger.exception("Fallo procesando mensaje %s; queda para reintento", message["MessageId"])
                continue
            self.client.delete_message(QueueUrl=self.queue_url, ReceiptHandle=message["ReceiptHandle"])
            processed += 1
        return processed

    def run_forever(self) -> None:
        while self._running:
            self.poll_once()


def start_background_consumer(
    queue_url: str | None,
    handler: Callable[[Event], None],
    region: str,
    endpoint_url: str | None = None,
) -> SqsEventConsumer | None:
    """Arranca el consumo en un hilo daemon. Sin cola configurada no hace nada (modo local)."""
    if not queue_url:
        logger.warning("Sin cola configurada; el servicio no consume eventos")
        return None
    import threading

    consumer = SqsEventConsumer(queue_url, handler, region, endpoint_url)
    threading.Thread(target=consumer.run_forever, name="sqs-consumer", daemon=True).start()
    return consumer
