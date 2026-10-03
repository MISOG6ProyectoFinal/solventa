from solventa_common.settings import ServiceSettings


class IdentidadSettings(ServiceSettings):
    service_name: str = "identidad"


settings = IdentidadSettings()
