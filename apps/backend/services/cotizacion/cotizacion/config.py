from solventa_common.settings import ServiceSettings


class CotizacionSettings(ServiceSettings):
    service_name: str = "cotizacion"
    # Consenso: el Service headless devuelve la IP de cada réplica de este mismo servicio.
    cotizacion_replicas_host: str = "cotizacion-replicas"
    cotizacion_port: int = 8000
    replicas_esperadas: int = 3
    quorum: int = 2
    consenso_timeout_s: float = 0.3


settings = CotizacionSettings()
