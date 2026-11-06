from solventa_common.settings import ServiceSettings


class PagosSettings(ServiceSettings):
    service_name: str = "pagos"
    pasarela_url: str = "http://simuladores/pasarela-pagos"
    pasarela_api_key: str | None = None


settings = PagosSettings()
