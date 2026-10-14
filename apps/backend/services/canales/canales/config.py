from solventa_common.settings import ServiceSettings


class CanalesSettings(ServiceSettings):
    service_name: str = "canales"
    cotizacion_url: str = "http://cotizacion"
    polizas_url: str = "http://polizas"
    siniestros_url: str = "http://siniestros"
    identidad_url: str = "http://identidad"
    # HMAC key. Must match the SESION_SECRETO that identidad used to sign the token.
    sesion_secreto: str
    cotizacion_timeout_s: float = 1.0


settings = CanalesSettings()
