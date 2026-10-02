"""Workers Siniestro Paramétrico (absorción de picos).

Competing Consumers sobre la cola del bus. KEDA escala las réplicas según
ApproximateNumberOfMessagesVisible; RDS Proxy agrupa sus conexiones a la base.
"""

import signal

from solventa_common.db import build_engine
from solventa_common.events import SqsEventConsumer
from solventa_common.idempotency import PostgresIdempotencyKeyValidator
from solventa_common.logging import configure_logging

from siniestros.config import settings
from siniestros.parametrico.adapters.bus import build_publisher
from siniestros.parametrico.adapters.repository import PostgresLiquidacionRepository
from siniestros.parametrico.domain.use_cases import LiquidarEventoUseCase


def main() -> None:
    configure_logging(f"{settings.service_name}-worker", settings.log_level)
    if not settings.database_url or not settings.events_queue_url:
        raise SystemExit("El worker necesita DB_* y EVENTS_QUEUE_URL")

    engine = build_engine(settings.database_url)
    validator = PostgresIdempotencyKeyValidator(engine)
    repository = PostgresLiquidacionRepository(engine)
    validator.create_schema()
    repository.create_schema()

    liquidar = LiquidarEventoUseCase(validator, repository, build_publisher())
    consumer = SqsEventConsumer(
        settings.events_queue_url, liquidar.execute, settings.aws_region, settings.aws_endpoint_url
    )
    # KEDA reduce réplicas con SIGTERM: se termina el lote en curso y se sale.
    signal.signal(signal.SIGTERM, lambda *_: consumer.stop())
    consumer.run_forever()


if __name__ == "__main__":
    main()
