"""Capa de integración: un adaptador por tercero, todos detrás del Circuit Breaker Global."""

from solventa_common.integration.adapters import (
    AcordReaseguroAdapter,
    FirmaNotificacionAdapter,
    KycAmlAdapter,
    OpenDataAdapter,
    OpenFinanceAdapter,
    PasarelaPagosAdapter,
)
from solventa_common.integration.base import ExternalAdapter, ServiceClient

__all__ = [
    "AcordReaseguroAdapter",
    "ExternalAdapter",
    "FirmaNotificacionAdapter",
    "KycAmlAdapter",
    "OpenDataAdapter",
    "OpenFinanceAdapter",
    "PasarelaPagosAdapter",
    "ServiceClient",
]
