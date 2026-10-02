from solventa_common.settings import ServiceSettings


class NotificacionesSettings(ServiceSettings):
    service_name: str = "notificaciones"


settings = NotificacionesSettings()
