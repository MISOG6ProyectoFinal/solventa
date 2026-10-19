from solventa_common.settings import ServiceSettings


class PagosSettings(ServiceSettings):
    service_name: str = "pagos"
    # Sin URL no hay proveedor real: el cobro usa el simulador de prototipo.
    pasarela_url: str | None = None
    pasarela_api_key: str | None = None


settings = PagosSettings()
