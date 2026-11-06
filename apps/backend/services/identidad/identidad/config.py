from solventa_common.integration import simulated_provider
from solventa_common.settings import ServiceSettings


class IdentidadSettings(ServiceSettings):
    service_name: str = "identidad"
    # HMAC key. Identidad signs tokens and canales verifies them with the same SESION_SECRETO.
    sesion_secreto: str
    firma_notificacion_url: str = simulated_provider("notificaciones")
    firma_notificacion_api_key: str | None = None
    operador_admin_correo: str | None = None
    operador_admin_nombre: str = "Administrador"
    operador_admin_contrasena: str | None = None


settings = IdentidadSettings()
