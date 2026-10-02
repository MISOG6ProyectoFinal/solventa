from solventa_common.settings import ServiceSettings


class SuscripcionSettings(ServiceSettings):
    service_name: str = "suscripcion"


settings = SuscripcionSettings()
