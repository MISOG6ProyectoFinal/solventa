"""Emite una póliza una sola vez por cotización, con cobro aprobado y cotización vigente al pagar."""

from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from solventa_common.vigencia_cotizacion import oferta_se_puede_cobrar

from polizas.ciclo_vida.domain.models import (
    ClientPolicy,
    Coverage,
    IssuePolicyRequest,
    Policy,
    PolicyStatus,
    RenewalOffer,
    Validity,
)
from polizas.ciclo_vida.domain.ports import (
    DuplicatePolicy,
    IdempotencyKeyReused,
    PaymentNotApproved,
    PaymentSource,
    PolicyNotFound,
    PolicyNotRenewable,
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
    def __init__(self, policies: PolicyRepository, today: Callable[[], date] | None = None) -> None:
        self.policies = policies
        self.today = today or _today

    def execute(self, cliente_id: str) -> list[ClientPolicy]:
        hoy = self.today()
        return [
            ClientPolicy(**policy.model_dump(), renovable=es_renovable(policy, hoy))
            for policy in self.policies.list_by_client(cliente_id)
        ]


class GetPolicyUseCase:
    """La póliza con su estado de hoy: una activa cuya vigencia ya terminó se informa como vencida."""

    def __init__(self, policies: PolicyRepository, today: Callable[[], date] | None = None) -> None:
        self.policies = policies
        self.today = today or _today

    def execute(self, policy_id: str) -> Policy:
        policy = self.policies.get_by_id(policy_id)
        if policy is None:
            raise PolicyNotFound
        return status_as_of(policy, self.today())


class ListRecentPoliciesUseCase:
    """Las últimas pólizas emitidas en cualquier canal, con su estado de hoy. Para la consulta del back-office."""

    def __init__(self, policies: PolicyRepository, today: Callable[[], date] | None = None) -> None:
        self.policies = policies
        self.today = today or _today

    def execute(self, limit: int) -> list[Policy]:
        today = self.today()
        return [status_as_of(policy, today) for policy in self.policies.list_recent(limit)]


def status_as_of(policy: Policy, today: date) -> Policy:
    if policy.estado is PolicyStatus.ACTIVE and policy.vigencia.hasta < today:
        return policy.model_copy(update={"estado": PolicyStatus.EXPIRED})
    return policy


class GetRenewalOfferUseCase:
    """Arma la oferta de la próxima vigencia. No guarda, no emite y no cobra."""

    def __init__(self, policies: PolicyRepository, today: Callable[[], date] | None = None) -> None:
        self.policies = policies
        self.today = today or _today

    def execute(self, poliza_id: str, cliente_id: str) -> RenewalOffer:
        policy = self.policies.get_by_id(poliza_id)
        if policy is None or policy.cliente_id != cliente_id:
            raise PolicyNotFound(poliza_id)
        if not es_renovable(policy, self.today()):
            raise PolicyNotRenewable(poliza_id)
        return RenewalOffer(
            poliza_id=policy.id,
            numero_poliza=policy.numero,
            producto_id=policy.producto_id,
            prima_actual=policy.prima,
            prima_propuesta=prima_propuesta(policy.prima),
            vigencia_actual=policy.vigencia.model_copy(),
            vigencia_propuesta=vigencia_propuesta(policy.vigencia),
            coberturas_propuestas=coberturas_propuestas(policy.coberturas),
        )


def _today() -> date:
    return datetime.now(UTC).date()


def es_renovable(policy: Policy, hoy: date) -> bool:
    """Activa y con la vigencia todavía en curso. Una ventana de días se añade solo aquí."""
    vigencia = policy.vigencia
    return policy.estado is PolicyStatus.ACTIVE and vigencia.desde <= vigencia.hasta and vigencia.hasta >= hoy


def prima_propuesta(prima_actual: Decimal) -> Decimal:
    """HU035 no define tarifa. La consulta repite la prima vigente hasta que exista una regla de precio."""
    return prima_actual


def vigencia_propuesta(actual: Validity) -> Validity:
    """La nueva vigencia empieza el día siguiente y conserva la duración del periodo actual."""
    duracion = (actual.hasta - actual.desde).days + 1
    desde = actual.hasta + timedelta(days=1)
    return Validity(desde=desde, hasta=desde + timedelta(days=duracion - 1))


def coberturas_propuestas(coberturas: list[Coverage]) -> list[Coverage]:
    return [cobertura.model_copy() for cobertura in coberturas]


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
