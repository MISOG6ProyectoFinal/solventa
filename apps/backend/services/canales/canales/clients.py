"""Clientes a los servicios internos, compartidos por los tres canales.

Un circuit breaker por servicio destino: si Pólizas cae, la cotización sigue.
"""

from solventa_common.integration import ServiceClient

from canales.config import settings

cotizacion = ServiceClient("cotizacion", settings.cotizacion_url)
polizas = ServiceClient("polizas", settings.polizas_url)
siniestros = ServiceClient("siniestros", settings.siniestros_url)
