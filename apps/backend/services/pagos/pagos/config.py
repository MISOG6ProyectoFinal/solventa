from solventa_common.settings import ServiceSettings


class PagosSettings(ServiceSettings):
    service_name: str = "pagos"


settings = PagosSettings()
