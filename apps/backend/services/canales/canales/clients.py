"""Clientes a los servicios internos, compartidos por los tres canales.

Un circuit breaker por servicio destino: si Pólizas cae, la cotización sigue.
"""

from typing import Any

from solventa_common.integration import ServiceClient

from canales.config import settings


class IdentityClient(ServiceClient):
    """Cliente de Identidad con PATCH para actualizar operadores."""

    def patch(self, path: str, **kwargs: Any) -> Any:
        return self._request("PATCH", path, **kwargs)


cotizacion = ServiceClient("cotizacion", settings.cotizacion_url, timeout_s=settings.cotizacion_timeout_s)
polizas = ServiceClient("polizas", settings.polizas_url, timeout_s=settings.polizas_timeout_s)
siniestros = ServiceClient("siniestros", settings.siniestros_url)
identidad = IdentityClient("identidad", settings.identidad_url)
pagos = ServiceClient("pagos", settings.pagos_url, timeout_s=settings.pagos_timeout_s)
