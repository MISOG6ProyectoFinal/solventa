from solventa_common.settings import ServiceSettings


class CatalogoProductosSettings(ServiceSettings):
    service_name: str = "catalogo-productos"


settings = CatalogoProductosSettings()
