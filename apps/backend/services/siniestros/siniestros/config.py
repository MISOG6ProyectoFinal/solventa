from solventa_common.settings import ServiceSettings


class SiniestrosSettings(ServiceSettings):
    service_name: str = "siniestros"
    evidencias_bucket: str = "solventa-evidencias"


settings = SiniestrosSettings()
