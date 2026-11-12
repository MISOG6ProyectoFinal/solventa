"""Capa de integración: un adaptador por tercero, todos detrás del Circuit Breaker Global."""

from solventa_common.integration.adapters import (
    AcordReaseguroAdapter,
    FirmaNotificacionAdapter,
    KycAmlAdapter,
    OpenDataAdapter,
    OpenFinanceAdapter,
    PasarelaPagosAdapter,
    RedAsistenciaAdapter,
)
from solventa_common.integration.base import ExternalAdapter, ServiceClient
from solventa_common.integration.simulators import cluster_service, simulated_provider

__all__ = [
    "AcordReaseguroAdapter",
    "ExternalAdapter",
    "cluster_service",
    "FirmaNotificacionAdapter",
    "KycAmlAdapter",
    "OpenDataAdapter",
    "OpenFinanceAdapter",
    "PasarelaPagosAdapter",
    "RedAsistenciaAdapter",
    "ServiceClient",
    "simulated_provider",
]
