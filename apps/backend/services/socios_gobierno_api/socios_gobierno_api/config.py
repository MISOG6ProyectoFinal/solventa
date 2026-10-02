from solventa_common.settings import ServiceSettings


class SociosGobiernoApiSettings(ServiceSettings):
    service_name: str = "socios-gobierno-api"


settings = SociosGobiernoApiSettings()
