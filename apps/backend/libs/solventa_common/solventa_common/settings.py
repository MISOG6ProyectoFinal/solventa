"""Configuración base de un microservicio, leída de variables de entorno."""

from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class ServiceSettings(BaseSettings):
    """Variables comunes a todos los servicios.

    Cada servicio hereda de esta clase y agrega lo propio. Los valores llegan del
    ConfigMap y los Secret de Kubernetes (ver deploy/k8s).
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "solventa-service"
    environment: str = "local"
    log_level: str = "INFO"

    # Persistencia (RDS PostgreSQL detrás de RDS Proxy en AWS)
    db_host: str | None = None
    db_port: int = 5432
    db_name: str | None = None
    db_user: str | None = None
    db_password: str | None = None

    # Caché de Perfil y Cotización (ElastiCache Redis)
    redis_url: str | None = None

    # Bus de eventos (SNS + SQS). aws_endpoint_url apunta a LocalStack en local.
    aws_region: str = "us-east-1"
    aws_endpoint_url: str | None = None
    events_topic_arn: str | None = None
    events_queue_url: str | None = None

    @cached_property
    def database_url(self) -> str | None:
        """URL de SQLAlchemy, o None si el servicio no tiene base de datos."""
        if not self.db_host or not self.db_name:
            return None
        return f"postgresql+psycopg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
