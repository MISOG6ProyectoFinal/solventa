from solventa_common.integration import simulated_provider
from solventa_common.settings import ServiceSettings


class PagosSettings(ServiceSettings):
    service_name: str = "pagos"
    pasarela_url: str = simulated_provider("pasarela-pagos")
    pasarela_api_key: str | None = None


settings = PagosSettings()
