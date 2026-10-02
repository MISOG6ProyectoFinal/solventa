from solventa_common.settings import ServiceSettings


class ValidadorConsensoSettings(ServiceSettings):
    service_name: str = "validador-consenso"
    # Service headless: el DNS devuelve la IP de cada réplica de Cotización.
    cotizacion_replicas_host: str = "cotizacion-rating-replicas"
    cotizacion_port: int = 8000
    replicas_esperadas: int = 3
    quorum: int = 2
    timeout_s: float = 0.3


settings = ValidadorConsensoSettings()
