from pydantic import model_validator
from solventa_common.integration import simulated_provider
from solventa_common.settings import ServiceSettings


class SiniestrosSettings(ServiceSettings):
    service_name: str = "siniestros"
    evidencias_bucket: str = "solventa-evidencias"
    red_asistencia_url: str = simulated_provider("red-asistencia")
    polizas_url: str = "http://polizas"
    # Postgres and S3. Tests leave this off and use the in-memory adapters.
    persistent_stores: bool = False

    @model_validator(mode="after")
    def drop_custom_endpoint_when_persistent(self):
        # AWS_ENDPOINT_URL is the LocalStack address. Real S3 must not receive it.
        if self.persistent_stores:
            self.aws_endpoint_url = None
        return self


settings = SiniestrosSettings()
