"""Emite una póliza una sola vez por cotización, con cobro aprobado y cotización vigente al pagar."""

from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal

from solventa_common.vigencia_cotizacion import oferta_se_puede_cobrar

from polizas.ciclo_vida.domain.models import Coverage, IssuePolicyRequest, Policy, Validity
from polizas.ciclo_vida.domain.ports import (
    DuplicatePolicy,
    IdempotencyKeyReused,
    PaymentNotApproved,
    PaymentSource,
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
