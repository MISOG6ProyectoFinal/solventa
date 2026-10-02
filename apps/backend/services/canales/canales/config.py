from solventa_common.settings import ServiceSettings


class CanalesSettings(ServiceSettings):
    service_name: str = "canales"
    cotizacion_url: str = "http://cotizacion"
    polizas_url: str = "http://polizas"
    siniestros_url: str = "http://siniestros"
    cotizacion_timeout_s: float = 1.0


settings = CanalesSettings()
