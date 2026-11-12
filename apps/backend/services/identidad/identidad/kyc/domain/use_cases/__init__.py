"""Casos de uso de KYC, uno por capacidad."""

from identidad.kyc.domain.use_cases.accounts import (
    SESSION_DAYS,
    RegisterClient,
    StartSession,
    issue_session,
)
from identidad.kyc.domain.use_cases.clients import (
    MAX_CLIENTS_PER_LOOKUP,
    AsegurarCliente,
    BuscarClientePorDocumento,
    ConsultarCliente,
    GetClient,
    ListClients,
    id_cliente,
)
from identidad.kyc.domain.use_cases.consent import (
    ConsultarConsentimiento,
    SolicitarConsentimiento,
    ValidarConsentimiento,
)

__all__ = [
    "SESSION_DAYS",
    "issue_session",
    "StartSession",
    "RegisterClient",
    "id_cliente",
    "BuscarClientePorDocumento",
    "GetClient",
    "ConsultarCliente",
    "MAX_CLIENTS_PER_LOOKUP",
    "ListClients",
    "AsegurarCliente",
    "SolicitarConsentimiento",
    "ValidarConsentimiento",
    "ConsultarConsentimiento",
]
