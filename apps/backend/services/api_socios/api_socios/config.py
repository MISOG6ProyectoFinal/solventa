from solventa_common.settings import ServiceSettings


class ApiSociosSettings(ServiceSettings):
    service_name: str = "api-socios"
    consenso_url: str = "http://validador-consenso"
    gobierno_socios_url: str = "http://socios-gobierno-api"


settings = ApiSociosSettings()
