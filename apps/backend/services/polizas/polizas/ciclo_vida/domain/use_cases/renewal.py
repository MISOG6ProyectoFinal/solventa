"""Oferta y aplicación de la renovación de una póliza."""

from collections.abc import Callable
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from solventa_common.events import Event, EventPublisher
from solventa_common.referencia_renovacion import referencia_ciclo_renovacion

from polizas.ciclo_vida.domain.models import (
    Coverage,
    Policy,
    PolicyStatus,
    Renewal,
    RenewalConfirmation,
    RenewalOffer,
    Validity,
)
from polizas.ciclo_vida.domain.ports import (
    DuplicateRenewal,
    PaymentDoesNotMatch,
    PaymentNotApproved,
    PaymentSource,
    PolicyNotFound,
    PolicyNotRenewable,
    PolicyRepository,
    RenewalAlreadyApplied,
)
from polizas.ciclo_vida.domain.use_cases.common import (
    MONEDA,
    POLIZA_RENOVADA,
    SOURCE,
    _payment_approved,
    _periodo,
    _today,
    publish_pending,
)


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
