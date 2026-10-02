from solventa_common.settings import ServiceSettings


class BffWebSettings(ServiceSettings):
    service_name: str = "bff-web"
    consenso_url: str = "http://validador-consenso"
    polizas_url: str = "http://polizas"
    siniestros_url: str = "http://siniestros"


settings = BffWebSettings()
