import logging

from solventa_common.events import Event, EventPublisher
from solventa_common.idempotency import IdempotencyKeyValidator

from siniestro_parametrico.domain.models import EventoParametrico, Liquidacion
from siniestro_parametrico.domain.ports import LiquidacionRepository

logger = logging.getLogger(__name__)

EVENTO_RECIBIDO = "evento_parametrico.recibido"
SINIESTRO_LIQUIDADO = "siniestro_parametrico.liquidado"
SOURCE = "siniestro-parametrico"


class RegistrarEventoUseCase:
    """La API solo valida y encola: el canal no espera la liquidación (Flujo 2)."""

    def __init__(self, publisher: EventPublisher) -> None:
        self.publisher = publisher

    def execute(self, evento: EventoParametrico) -> Event:
        event = Event(
            event_type=EVENTO_RECIBIDO,
            source=SOURCE,
            idempotency_key=evento.idempotency_key,
            payload=evento.model_dump(mode="json"),
        )
        self.publisher.publish(event)
        return event


class LiquidarEventoUseCase:
    """Idempotent Receiver: una sola liquidación por evento bajo reentregas y consumo concurrente."""

    def __init__(
        self,
        validator: IdempotencyKeyValidator,
        repository: LiquidacionRepository,
        publisher: EventPublisher,
    ) -> None:
        self.validator = validator
        self.repository = repository
        self.publisher = publisher

    def execute(self, event: Event) -> Liquidacion | None:
        if event.event_type != EVENTO_RECIBIDO:
            return None
        evento = EventoParametrico.model_validate(event.payload)
        if not evento.supera_umbral():
            logger.info("Evento %s bajo el umbral; no se liquida", evento.idempotency_key)
            return None
        if not self.validator.claim(evento.idempotency_key, scope="liquidacion"):
            logger.info("Evento %s ya liquidado; se descarta el duplicado", evento.idempotency_key)
            return None
        liquidacion = Liquidacion(
            idempotency_key=evento.idempotency_key,
            poliza_id=evento.poliza_id,
            monto=evento.monto_asegurado,
            evento=event.event_id,
        )
        self.repository.save(liquidacion)
        self.publisher.publish(
            Event(
                event_type=SINIESTRO_LIQUIDADO,
                source=SOURCE,
                idempotency_key=liquidacion.idempotency_key,
                payload=liquidacion.model_dump(mode="json"),
            )
        )
        return liquidacion
