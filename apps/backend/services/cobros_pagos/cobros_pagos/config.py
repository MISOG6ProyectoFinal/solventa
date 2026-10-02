from solventa_common.settings import ServiceSettings


class CobrosPagosSettings(ServiceSettings):
    service_name: str = "cobros-pagos"


settings = CobrosPagosSettings()
