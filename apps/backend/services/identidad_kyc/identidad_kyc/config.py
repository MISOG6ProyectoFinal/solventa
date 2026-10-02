from solventa_common.settings import ServiceSettings


class IdentidadKycSettings(ServiceSettings):
    service_name: str = "identidad-kyc"


settings = IdentidadKycSettings()
