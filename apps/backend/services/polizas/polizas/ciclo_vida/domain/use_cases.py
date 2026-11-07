"""Emite una póliza una sola vez por cotización, con cobro aprobado y cotización vigente al pagar."""

from collections.abc import Callable
from datetime import UTC, date, datetime
from decimal import Decimal

from solventa_common.vigencia_cotizacion import oferta_se_puede_cobrar

from polizas.ciclo_vida.domain.models import Beneficiary, Coverage, IssuePolicyRequest, Policy, PolicyStatus, Validity
from polizas.ciclo_vida.domain.ports import (
    DuplicatePolicy,
    IdempotencyKeyReused,
    PaymentNotApproved,
    PaymentSource,
    PolicyNotFound,
    PolicyRepository,
    QuoteExpired,
    QuoteNotFound,
    QuoteSource,
)

APPROVED = "aprobado"


class IssuePolicyUseCase:
    def __init__(
        self,
        policies: PolicyRepository,
        quotes: QuoteSource,
        payments: PaymentSource,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self.policies = policies
        self.quotes = quotes
        self.payments = payments
        self.now = now

    def execute(self, request: IssuePolicyRequest) -> tuple[Policy, bool]:
        """Devuelve la póliza y si se creó en esta llamada. Un reintento devuelve la misma."""
        replay = self._replay(request)
        if replay is not None:
            return replay, False

        quote = self.quotes.get(request.cotizacion_id)
        if quote is None or not _same_owner(quote, request):
            raise QuoteNotFound(request.cotizacion_id)
        issued = self.policies.get_by_quote(request.cotizacion_id)
        if issued is not None:
            return issued, False

        payment = self.payments.get(request.cobro_id)
        approved = _approved_for(payment, quote)
        paid_at = datetime.fromisoformat(payment["creado_en"]) if approved and payment else self.now()
        if not oferta_se_puede_cobrar(quote.get("vigente_hasta"), paid_at):
            raise QuoteExpired(request.cotizacion_id)
        if not approved:
            raise PaymentNotApproved(request.cobro_id)

        policy = _policy(request, quote)
        try:
            self.policies.add(policy)
        except DuplicatePolicy:
            existing = self._replay(request) or self.policies.get_by_quote(request.cotizacion_id)
            if existing is None:
                raise
            return existing, False
        return policy, True

    def _replay(self, request: IssuePolicyRequest) -> Policy | None:
        existing = self.policies.get_by_idempotency_key(request.idempotency_key)
        if existing is not None and existing.cotizacion_id != request.cotizacion_id:
            raise IdempotencyKeyReused(request.idempotency_key)
        return existing


class ListClientPoliciesUseCase:
    def __init__(self, policies: PolicyRepository) -> None:
        self.policies = policies

    def execute(self, cliente_id: str) -> list[Policy]:
        return self.policies.list_by_client(cliente_id)


def with_effective_status(policy: Policy, today: date) -> Policy:
    """Una póliza activa cuya vigencia ya terminó se muestra como VENCIDA."""
    if policy.estado is PolicyStatus.ACTIVE and policy.vigencia.hasta < today:
        return policy.model_copy(update={"estado": PolicyStatus.EXPIRED})
    return policy


class SearchPoliciesUseCase:
    def __init__(self, policies: PolicyRepository, today: Callable[[], date] = date.today) -> None:
        self.policies = policies
        self.today = today

    def execute(self, text: str | None, cliente_ids: list[str]) -> list[Policy]:
        found = self.policies.search((text or "").strip() or None, cliente_ids)
        return [with_effective_status(policy, self.today()) for policy in found]


class GetPolicyUseCase:
    def __init__(self, policies: PolicyRepository, today: Callable[[], date] = date.today) -> None:
        self.policies = policies
        self.today = today

    def execute(self, policy_id: str) -> Policy:
        policy = self.policies.get(policy_id)
        if policy is None:
            raise PolicyNotFound(policy_id)
        return with_effective_status(policy, self.today())

    def beneficiaries(self, policy_id: str) -> list[Beneficiary]:
        self.execute(policy_id)
        return self.policies.list_beneficiaries(policy_id)


def _same_owner(quote: dict, request: IssuePolicyRequest) -> bool:
    if request.canal == "socios":
        return request.socio_id is not None and quote.get("socio_id") == request.socio_id
    return request.cliente_id is not None and quote.get("cliente_id") == request.cliente_id


def _approved_for(payment: dict | None, quote: dict) -> bool:
    return (
        payment is not None
        and payment.get("estado") == APPROVED
        and payment.get("cotizacion_id") == quote["id"]
        and Decimal(str(payment.get("monto"))) == Decimal(str(quote["prima"]))
    )


def _policy(request: IssuePolicyRequest, quote: dict) -> Policy:
    validity = quote["vigencia_propuesta"]
    return Policy(
        cotizacion_id=request.cotizacion_id,
        cobro_id=request.cobro_id,
        producto_id=quote["producto_id"],
        prima=Decimal(str(quote["prima"])),
        coberturas=[Coverage(**coverage) for coverage in quote.get("coberturas", [])],
        vigencia=Validity(desde=validity["desde"], hasta=validity["hasta"]),
        canal=request.canal,
        socio_id=request.socio_id,
        cliente_id=request.cliente_id,
        idempotency_key=request.idempotency_key,
    )
