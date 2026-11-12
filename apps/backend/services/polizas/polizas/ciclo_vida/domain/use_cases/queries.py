"""Consultas de pólizas: por cliente, por id, recientes y búsqueda."""

from collections.abc import Callable
from datetime import date

from polizas.ciclo_vida.domain.models import (
    AppliedRenewal,
    Beneficiary,
    ClientPolicy,
    Policy,
)
from polizas.ciclo_vida.domain.ports import (
    PolicyNotFound,
    PolicyRepository,
)
from polizas.ciclo_vida.domain.use_cases.common import (
    _today,
    with_effective_status,
)
from polizas.ciclo_vida.domain.use_cases.renewal import es_renovable, renovacion_adelantada


class ListClientPoliciesUseCase:
    def __init__(self, policies: PolicyRepository, today: Callable[[], date] | None = None) -> None:
        self.policies = policies
        self.today = today or _today

    def execute(self, cliente_id: str) -> list[ClientPolicy]:
        hoy = self.today()
        self.policies.expire_ended(hoy)
        found = self.policies.list_by_client(cliente_id)
        renewals = self.policies.list_renewals([policy.id for policy in found])
        listed: list[ClientPolicy] = []
        for policy in found:
            ahead = renovacion_adelantada(policy, renewals)
            listed.append(
                ClientPolicy(
                    **policy.model_dump(),
                    renovable=es_renovable(policy, hoy, ahead is not None),
                    renovacion=None
                    if ahead is None
                    else AppliedRenewal(cobro_id=ahead.cobro_id, vigencia_nueva=ahead.vigencia_nueva),
                )
            )
        return listed


class GetPolicyUseCase:
    """La póliza con su estado de hoy: una activa cuya vigencia ya terminó se guarda como vencida."""

    def __init__(self, policies: PolicyRepository, today: Callable[[], date] | None = None) -> None:
        self.policies = policies
        self.today = today or _today

    def execute(self, policy_id: str) -> Policy:
        self.policies.expire_ended(self.today())
        policy = self.policies.get_by_id(policy_id) or self.policies.get(policy_id)
        if policy is None:
            raise PolicyNotFound(policy_id)
        return policy

    def beneficiaries(self, policy_id: str) -> list[Beneficiary]:
        self.execute(policy_id)
        return self.policies.list_beneficiaries(policy_id)


class ListRecentPoliciesUseCase:
    """Las últimas pólizas emitidas en cualquier canal, con su estado de hoy. Para la consulta del back-office."""

    def __init__(self, policies: PolicyRepository, today: Callable[[], date] | None = None) -> None:
        self.policies = policies
        self.today = today or _today

    def execute(self, limit: int) -> list[Policy]:
        self.policies.expire_ended(self.today())
        return self.policies.list_recent(limit)


class SearchPoliciesUseCase:
    def __init__(self, policies: PolicyRepository, today: Callable[[], date] = date.today) -> None:
        self.policies = policies
        self.today = today

    def execute(self, text: str | None, cliente_ids: list[str]) -> list[Policy]:
        found = self.policies.search((text or "").strip() or None, cliente_ids)
        return [with_effective_status(policy, self.today()) for policy in found]
