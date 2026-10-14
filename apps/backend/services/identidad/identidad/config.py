from solventa_common.settings import ServiceSettings


class IdentidadSettings(ServiceSettings):
    service_name: str = "identidad"
    # Local and tests. A deployed environment sets SESION_SECRETO so tokens are not signed with this value.
    sesion_secreto: str = "solventa-local-sesion"


settings = IdentidadSettings()
