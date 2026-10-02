from solventa_common.settings import ServiceSettings


class CotizacionRatingSettings(ServiceSettings):
    service_name: str = "cotizacion-rating"


settings = CotizacionRatingSettings()
