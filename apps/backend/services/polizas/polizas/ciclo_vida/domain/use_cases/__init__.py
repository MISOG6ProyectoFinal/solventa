"""Casos de uso de Pólizas, uno por capacidad."""

from polizas.ciclo_vida.domain.use_cases.cancellation import (
    CancelPolicyUseCase,
)
from polizas.ciclo_vida.domain.use_cases.common import (
    APPROVED,
    MONEDA,
    POLIZA_CANCELADA,
    POLIZA_ENDOSADA,
    POLIZA_RENOVADA,
    SOURCE,
    publish_pending,
    with_effective_status,
)
from polizas.ciclo_vida.domain.use_cases.endorsement import (
    RegisterEndorsementUseCase,
)
from polizas.ciclo_vida.domain.use_cases.issuance import (
    IssuePolicyUseCase,
)
from polizas.ciclo_vida.domain.use_cases.queries import (
    GetPolicyUseCase,
    ListClientPoliciesUseCase,
    ListRecentPoliciesUseCase,
    SearchPoliciesUseCase,
)
from polizas.ciclo_vida.domain.use_cases.renewal import (
    ApplyRenewalUseCase,
    GetRenewalOfferUseCase,
    coberturas_propuestas,
    es_renovable,
    prima_propuesta,
    renovacion_adelantada,
    vigencia_propuesta,
)

__all__ = [
    "POLIZA_RENOVADA",
    "POLIZA_ENDOSADA",
    "POLIZA_CANCELADA",
    "SOURCE",
    "MONEDA",
    "APPROVED",
    "with_effective_status",
    "publish_pending",
    "IssuePolicyUseCase",
    "ListClientPoliciesUseCase",
    "GetPolicyUseCase",
    "ListRecentPoliciesUseCase",
    "SearchPoliciesUseCase",
    "GetRenewalOfferUseCase",
    "es_renovable",
    "renovacion_adelantada",
    "prima_propuesta",
    "vigencia_propuesta",
    "coberturas_propuestas",
    "ApplyRenewalUseCase",
    "RegisterEndorsementUseCase",
    "CancelPolicyUseCase",
]
