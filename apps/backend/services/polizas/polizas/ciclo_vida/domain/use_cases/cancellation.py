"""Cancelación definitiva con devolución calculada por Cotización."""

from collections.abc import Callable
from datetime import date

from solventa_common.events import Event, EventPublisher

from polizas.ciclo_vida.domain.models import (
    NON_REFUNDABLE_CAUSES,
    CancellationCause,
    CancellationQuote,
    CancellationRequest,
    Policy,
    PolicyStatus,
)
from polizas.ciclo_vida.domain.ports import (
    PolicyNotCancellable,
    PolicyNotFound,
    PolicyRepository,
    RefundCalculator,
)
from polizas.ciclo_vida.domain.use_cases.common import (
    POLIZA_CANCELADA,
    SOURCE,
    _today,
    publish_pending,
)


class CancelPolicyUseCase:
    """Cancelación definitiva. La devolución la calcula Cotización y Rating; Pagos y Auditoría reaccionan al evento."""

    def __init__(
        self,
        policies: PolicyRepository,
        refunds: RefundCalculator,
        publisher: EventPublisher,
        today: Callable[[], date] | None = None,
    ) -> None:
        self.policies = policies
        self.refunds = refunds
        self.publisher = publisher
        self.today = today or _today

    def quote(self, poliza_id: str, cause: CancellationCause) -> CancellationQuote:
        policy = self._cancellable(poliza_id)
        return self._refund(policy, cause)

    def execute(self, poliza_id: str, request: CancellationRequest) -> CancellationQuote:
        policy = self._cancellable(poliza_id)
        refund = self._refund(policy, request.causa)  # se recalcula: no se confía en el monto del cliente
        event = _cancellation_event(policy, request, refund)
        if not self.policies.cancel(policy.id, request.causa.value, self.today(), event):
            raise PolicyNotCancellable(poliza_id)
        publish_pending(self.policies, self.publisher)
        return refund

    def _cancellable(self, poliza_id: str) -> Policy:
        self.policies.expire_ended(self.today())
        policy = self.policies.get(poliza_id)
        if policy is None:
            raise PolicyNotFound(poliza_id)
        if policy.estado is not PolicyStatus.ACTIVE:
            raise PolicyNotCancellable(poliza_id)
        return policy

    def _refund(self, policy: Policy, cause: CancellationCause) -> CancellationQuote:
        data = self.refunds.calculate(policy, self.today(), cause not in NON_REFUNDABLE_CAUSES)
        return CancellationQuote(**data)


def _cancellation_event(policy: Policy, request: CancellationRequest, refund: CancellationQuote) -> Event:
    return Event(
        event_type=POLIZA_CANCELADA,
        source=SOURCE,
        idempotency_key=f"{POLIZA_CANCELADA}:{policy.id}",
        payload={
            "poliza_id": policy.id,
            "causa_cancelacion": request.causa.value,
            "usuario_id": request.usuario_id,
            "monto_reintegro": str(refund.monto_reintegro),
        },
    )
