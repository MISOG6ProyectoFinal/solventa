from solventa_common.settings import ServiceSettings


class BffMovilSettings(ServiceSettings):
    service_name: str = "bff-movil"
    consenso_url: str = "http://validador-consenso"
    siniestros_url: str = "http://siniestros"


settings = BffMovilSettings()
