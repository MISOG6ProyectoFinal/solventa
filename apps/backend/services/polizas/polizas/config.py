from solventa_common.settings import ServiceSettings


class PolizasSettings(ServiceSettings):
    service_name: str = "polizas"
    cotizacion_url: str = "http://cotizacion"
    pagos_url: str = "http://pagos"


settings = PolizasSettings()
