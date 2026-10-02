from solventa_common.settings import ServiceSettings


class SiniestrosSettings(ServiceSettings):
    service_name: str = "siniestros"


settings = SiniestrosSettings()
