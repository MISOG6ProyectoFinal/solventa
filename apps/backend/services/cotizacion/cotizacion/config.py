from pydantic import Field
from solventa_common.settings import ServiceSettings


class CotizacionSettings(ServiceSettings):
    service_name: str = "cotizacion"
    # Consenso: el Service headless devuelve la IP de cada réplica de este mismo servicio.
    cotizacion_replicas_host: str = "cotizacion-replicas"
    puerto_replicas: int = 8000
    replicas_esperadas: int = 3
    quorum: int = 2
    consenso_timeout_s: float = 0.3
    # Open Finance (ASR-03): presupuesto de 300 ms y techo duro de 3000 ms. Sin URL responde el sandbox.
    open_finance_url: str | None = None
    open_finance_api_key: str | None = None
    open_finance_timeout_s: float = Field(default=0.3, gt=0, le=3.0)
    signal_cache_ttl_s: int = 86_400


settings = CotizacionSettings()
