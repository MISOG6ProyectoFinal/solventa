from solventa_common.settings import ServiceSettings


class CanalesSettings(ServiceSettings):
    service_name: str = "canales"
    cotizacion_url: str = "http://cotizacion"
    polizas_url: str = "http://polizas"
    siniestros_url: str = "http://siniestros"
    identidad_url: str = "http://identidad"
    pagos_url: str = "http://pagos"
    # HMAC key. Must match the SESION_SECRETO that identidad used to sign the token.
    sesion_secreto: str
    cotizacion_timeout_s: float = 5.0
    pagos_timeout_s: float = 4.0
    # Mayor que el presupuesto de Pólizas, que lee Cotización y Pagos con 1 s cada uno.
    polizas_timeout_s: float = 3.0


settings = CanalesSettings()
