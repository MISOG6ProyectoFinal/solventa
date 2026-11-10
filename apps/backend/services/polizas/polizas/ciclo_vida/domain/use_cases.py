"""Emite una póliza una sola vez por cotización, con cobro aprobado y cotización vigente al pagar."""

import logging
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from solventa_common.events import Event, EventPublisher
from solventa_common.referencia_renovacion import referencia_ciclo_renovacion
from solventa_common.vigencia_cotizacion import oferta_se_puede_cobrar

from polizas.ciclo_vida.domain.models import (
    AppliedRenewal,
    Beneficiary,
    ClientPolicy,
    Coverage,
    Endorsement,
    EndorsementRequest,
    IssuePolicyRequest,
    Policy,
    PolicyStatus,
    Renewal,
    RenewalConfirmation,
    RenewalOffer,
    Validity,
)
from polizas.ciclo_vida.domain.ports import (
    DuplicatePolicy,
    DuplicateRenewal,
    IdempotencyKeyReused,
    InvalidEndorsement,
    PaymentDoesNotMatch,
    PaymentNotApproved,
    PaymentSource,
    PolicyNotEndorsable,
    PolicyNotFound,
    PolicyNotRenewable,
    PolicyRepository,
    QuoteExpired,
    QuoteNotFound,
    QuoteSource,
    RenewalAlreadyApplied,
)

logger = logging.getLogger(__name__)

POLIZA_RENOVADA = "poliza.renovada"
POLIZA_ENDOSADA = "poliza.endosada"
SOURCE = "polizas"
MONEDA = "COP"

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


class GetRenewalOfferUseCase:
    """Arma la oferta de la próxima vigencia. No emite, no cobra y no guarda una oferta."""

    def __init__(self, policies: PolicyRepository, today: Callable[[], date] | None = None) -> None:
        self.policies = policies
        self.today = today or _today

    def execute(self, poliza_id: str, cliente_id: str) -> RenewalOffer:
        self.policies.activate_renewed_terms(self.today())
        policy = self.policies.get_by_id(poliza_id)
        if policy is None or policy.cliente_id != cliente_id:
            raise PolicyNotFound(poliza_id)
        ahead = renovacion_adelantada(policy, self.policies.list_renewals([policy.id]))
        if not es_renovable(policy, self.today(), ahead is not None):
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


def es_renovable(policy: Policy, hoy: date, renovacion_ya_aplicada: bool = False) -> bool:
    """Activa, vigente y sin una renovación ya aplicada para el ciclo que se ofrecería.

    No se inventa una ventana de días. El ciclo siguiente solo vuelve a evaluarse cuando
    la vigencia renovada pasa a ser la cobertura en curso.
    """
    vigencia = policy.vigencia
    vigente = policy.estado is PolicyStatus.ACTIVE and vigencia.desde <= vigencia.hasta and vigencia.hasta >= hoy
    return vigente and not renovacion_ya_aplicada


def renovacion_adelantada(policy: Policy, renewals: list[Renewal]) -> Renewal | None:
    """Renovación cuya vigencia nueva empieza después de la cobertura que sigue en curso."""
    ahead = [
        renewal
        for renewal in renewals
        if renewal.poliza_id == policy.id and renewal.vigencia_nueva.desde > policy.vigencia.hasta
    ]
    if not ahead:
        return None
    return max(ahead, key=lambda renewal: renewal.vigencia_nueva.desde)


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


def publish_pending(policies: PolicyRepository, publisher: EventPublisher) -> int:
    """Publica los eventos ya confirmados en la base. Un fallo deja el evento pendiente."""
    published = 0
    for event in policies.pending_events():
        try:
            publisher.publish(event)
        except Exception:
            logger.exception("No se pudo publicar el evento %s", event.event_id)
            continue
        policies.mark_published(event.event_id)
        published += 1
    return published


class RegisterEndorsementUseCase:
    """Endoso de datos del asegurado: guarda versión anterior y nueva en Pólizas y publica el evento de auditoría."""

    def __init__(
        self, policies: PolicyRepository, publisher: EventPublisher, today: Callable[[], date] | None = None
    ) -> None:
        self.policies = policies
        self.publisher = publisher
        self.today = today or _today

    def execute(self, poliza_id: str, request: EndorsementRequest) -> Endorsement:
        self.policies.expire_ended(self.today())
        policy = self.policies.get(poliza_id)
        if policy is None:
            raise PolicyNotFound(poliza_id)
        if policy.estado is not PolicyStatus.ACTIVE:
            raise PolicyNotEndorsable(poliza_id)
        if not policy.vigencia.desde <= request.fecha_efectiva <= policy.vigencia.hasta:
            raise InvalidEndorsement(
                "fecha_efectiva_fuera_de_vigencia", "La fecha efectiva debe estar dentro de la vigencia de la póliza."
            )
        if request.version_nueva == request.version_anterior:
            raise InvalidEndorsement("endoso_sin_cambios", "El endoso debe cambiar al menos un dato del asegurado.")
        endorsement = Endorsement(
            poliza_id=policy.id,
            fecha_efectiva=request.fecha_efectiva,
            motivo=request.motivo,
            usuario_id=request.usuario_id,
            version_anterior=request.version_anterior.model_dump(),
            version_nueva=request.version_nueva.model_dump(),
        )
        self.policies.save_endorsement(endorsement, _endorsement_event(endorsement))
        publish_pending(self.policies, self.publisher)
        return endorsement

    def list(self, poliza_id: str) -> list[Endorsement]:
        if self.policies.get(poliza_id) is None:
            raise PolicyNotFound(poliza_id)
        return self.policies.list_endorsements(poliza_id)


class ApplyRenewalUseCase:
    """Aplica un ciclo ya cobrado. No emite otra póliza ni vuelve a cobrar."""

    def __init__(
        self,
        policies: PolicyRepository,
        payments: PaymentSource,
        publisher: EventPublisher,
        today: Callable[[], date] | None = None,
    ) -> None:
        self.policies = policies
        self.payments = payments
        self.publisher = publisher
        self.today = today or _today

    def execute(self, poliza_id: str, cliente_id: str, cobro_id: str) -> tuple[RenewalConfirmation, bool]:
        policy = self._policy(poliza_id, cliente_id)
        stored = self.policies.get_renewal_by_payment(cobro_id)
        if stored is not None:
            if stored.poliza_id != policy.id:
                raise PaymentDoesNotMatch(cobro_id)
            self.publish_pending()
            return _confirmation(policy, stored), False

        payment = self.payments.get(cobro_id)
        if payment is None or not _payment_approved(payment):
            raise PaymentNotApproved(cobro_id)

        ciclo_pago = str(payment.get("referencia_id") or "")
        by_cycle = self.policies.get_renewal_by_cycle(ciclo_pago) if ciclo_pago else None
        if by_cycle is not None:
            if by_cycle.poliza_id == policy.id and by_cycle.cobro_id == cobro_id:
                self.publish_pending()
                return _confirmation(policy, by_cycle), False
            raise RenewalAlreadyApplied(ciclo_pago)

        self.policies.activate_renewed_terms(self.today())
        policy = self._policy(poliza_id, cliente_id)
        if not es_renovable(policy, self.today()):
            raise PolicyNotRenewable(poliza_id)
        propuesta = vigencia_propuesta(policy.vigencia)
        ciclo = referencia_ciclo_renovacion(policy.id, _periodo(propuesta))
        if not _payment_matches(payment, cliente_id, ciclo, prima_propuesta(policy.prima)):
            raise PaymentDoesNotMatch(cobro_id)
        if renovacion_adelantada(policy, self.policies.list_renewals([policy.id])) is not None:
            raise RenewalAlreadyApplied(ciclo)

        renewal = Renewal(
            poliza_id=policy.id,
            ciclo=ciclo,
            cobro_id=cobro_id,
            vigencia_anterior=policy.vigencia.model_copy(),
            vigencia_nueva=propuesta,
            prima_anterior=policy.prima,
            prima_nueva=prima_propuesta(policy.prima),
        )
        event = _event(renewal)
        try:
            self.policies.save_renewal(renewal, event)
        except DuplicateRenewal:
            return self._already_saved(policy, cobro_id, ciclo)
        self.publish_pending()
        return _confirmation(policy, renewal), True

    def publish_pending(self) -> int:
        return publish_pending(self.policies, self.publisher)

    def _policy(self, poliza_id: str, cliente_id: str) -> Policy:
        policy = self.policies.get_by_id(poliza_id)
        if policy is None or policy.cliente_id != cliente_id:
            raise PolicyNotFound(poliza_id)
        return policy

    def _already_saved(self, policy: Policy, cobro_id: str, ciclo: str) -> tuple[RenewalConfirmation, bool]:
        stored = self.policies.get_renewal_by_payment(cobro_id) or self.policies.get_renewal_by_cycle(ciclo)
        if stored is not None and stored.poliza_id == policy.id and stored.cobro_id == cobro_id:
            self.publish_pending()
            return _confirmation(policy, stored), False
        raise RenewalAlreadyApplied(ciclo)


def _periodo(vigencia: Validity) -> dict[str, str]:
    return {"desde": vigencia.desde.isoformat(), "hasta": vigencia.hasta.isoformat()}


def _payment_approved(payment: dict | None) -> bool:
    return payment is not None and payment.get("estado") == APPROVED


def _payment_matches(payment: dict, cliente_id: str, ciclo: str, prima: Decimal) -> bool:
    try:
        monto = Decimal(str(payment.get("monto"))).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return False
    return (
        payment.get("tipo_referencia") == "renovacion"
        and payment.get("cliente_id") == cliente_id
        and payment.get("referencia_id") == ciclo
        and payment.get("moneda") == MONEDA
        and monto == prima.quantize(Decimal("0.01"))
    )


def _endorsement_event(endorsement: Endorsement) -> Event:
    return Event(
        event_type=POLIZA_ENDOSADA,
        source=SOURCE,
        idempotency_key=f"{POLIZA_ENDOSADA}:{endorsement.id}",
        occurred_at=endorsement.creado_en,
        payload={
            "poliza_id": endorsement.poliza_id,
            "endoso_id": endorsement.id,
            "tipo": endorsement.tipo,
            "usuario_id": endorsement.usuario_id,
            "fecha_efectiva": endorsement.fecha_efectiva.isoformat(),
            "motivo": endorsement.motivo,
            "version_anterior": endorsement.version_anterior,
            "version_nueva": endorsement.version_nueva,
        },
    )


def _event(renewal: Renewal) -> Event:
    return Event(
        event_type=POLIZA_RENOVADA,
        source=SOURCE,
        idempotency_key=f"{POLIZA_RENOVADA}:{renewal.ciclo}",
        payload={
            "poliza_id": renewal.poliza_id,
            "cobro_id": renewal.cobro_id,
            "ciclo_renovacion": renewal.ciclo,
            "vigencia_anterior": renewal.vigencia_anterior.model_dump(mode="json"),
            "vigencia_nueva": renewal.vigencia_nueva.model_dump(mode="json"),
        },
    )


def _confirmation(policy: Policy, renewal: Renewal) -> RenewalConfirmation:
    return RenewalConfirmation(
        poliza_id=policy.id,
        numero_poliza=policy.numero,
        producto_id=policy.producto_id,
        cobro_id=renewal.cobro_id,
        vigencia_anterior=renewal.vigencia_anterior,
        vigencia_nueva=renewal.vigencia_nueva,
        coberturas=[cobertura.model_copy() for cobertura in policy.coberturas],
    )
