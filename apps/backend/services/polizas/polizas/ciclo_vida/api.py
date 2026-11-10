from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, Response, status
from solventa_common.db import build_engine
from solventa_common.events import EventPublisher, InMemoryEventPublisher
from solventa_common.integration import ServiceClient
from solventa_common.integration.base import call_upstream

from polizas.ciclo_vida.adapters.bus import build_publisher
from polizas.ciclo_vida.adapters.repository import InMemoryPolicyRepository, PostgresPolicyRepository
from polizas.ciclo_vida.adapters.upstream import PaymentReader, QuoteReader
from polizas.ciclo_vida.domain.models import (
    CANCELLATION_CAUSE_NAMES,
    NON_REFUNDABLE_CAUSES,
    STATUS_NAMES,
    Beneficiary,
    CancellationCauseOption,
    CatalogOption,
    ClientPolicy,
    Endorsement,
    EndorsementRequest,
    IssuePolicyRequest,
    Policy,
    RenewalConfirmation,
    RenewalOffer,
    RenewalRequest,
    endorsement_types_for_ramo,
)
from polizas.ciclo_vida.domain.ports import (
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
from polizas.ciclo_vida.domain.use_cases import (
    ApplyRenewalUseCase,
    GetPolicyUseCase,
    GetRenewalOfferUseCase,
    IssuePolicyUseCase,
    ListClientPoliciesUseCase,
    ListRecentPoliciesUseCase,
    RegisterEndorsementUseCase,
    SearchPoliciesUseCase,
)
from polizas.config import settings

router = APIRouter(prefix="/polizas", tags=["Pólizas y Ciclo de Vida"])

use_cases: dict = {}


def wire(
    policies: PolicyRepository,
    quotes: QuoteSource,
    payments: PaymentSource,
    publisher: EventPublisher | None = None,
) -> None:
    if hasattr(policies, "create_schema"):
        policies.create_schema()
    bus = publisher or InMemoryEventPublisher()
    use_cases["publisher"] = bus
    use_cases["issue"] = IssuePolicyUseCase(policies, quotes, payments)
    use_cases["list"] = ListClientPoliciesUseCase(policies)
    use_cases["recent"] = ListRecentPoliciesUseCase(policies)
    use_cases["renewal_offer"] = GetRenewalOfferUseCase(policies)
    use_cases["search"] = SearchPoliciesUseCase(policies)
    use_cases["get"] = GetPolicyUseCase(policies)
    use_cases["endorse"] = RegisterEndorsementUseCase(policies, bus)
    use_cases["apply"] = ApplyRenewalUseCase(policies, payments, bus)


def _default_wire() -> None:
    if settings.database_url:
        policies: PolicyRepository = PostgresPolicyRepository(build_engine(settings.database_url))
    else:
        policies = InMemoryPolicyRepository()
    quotes = QuoteReader(ServiceClient("cotizacion", settings.cotizacion_url))
    payments = PaymentReader(ServiceClient("pagos", settings.pagos_url))
    wire(policies, quotes, payments, build_publisher())


_default_wire()


_CLIENTE_OBLIGATORIO = "El cliente es obligatorio."
_POLIZA_NO_EXISTE = "La póliza no existe."


def _error(code: int, codigo: str, mensaje: str) -> HTTPException:
    return HTTPException(code, {"codigo": codigo, "mensaje": mensaje})


@router.get("/")
def info() -> dict:
    return {"component": "Pólizas y Ciclo de Vida"}


@router.get("/catalogos/estados", response_model=list[CatalogOption])
def list_statuses() -> list[CatalogOption]:
    """Estados en los que puede estar una póliza."""
    return [CatalogOption(id=status.value, nombre=name) for status, name in STATUS_NAMES.items()]


@router.get("/catalogos/causas-cancelacion", response_model=list[CancellationCauseOption])
def list_cancellation_causes() -> list[CancellationCauseOption]:
    """Causas con que se cancela una póliza y si la causa da derecho a devolución de prima."""
    return [
        CancellationCauseOption(id=cause.value, nombre=name, reembolsable=cause not in NON_REFUNDABLE_CAUSES)
        for cause, name in CANCELLATION_CAUSE_NAMES.items()
    ]


@router.get("/catalogos/tipos-endoso", response_model=list[CatalogOption])
def list_endorsement_types(ramo_id: str | None = None) -> list[CatalogOption]:
    """Tipos de endoso permitidos según el ramo de la póliza."""
    return [CatalogOption(id=type_id, nombre=name) for type_id, name in endorsement_types_for_ramo(ramo_id).items()]


@router.get("/clientes/{cliente_id}", response_model=list[ClientPolicy])
def list_client_policies(cliente_id: str) -> list[ClientPolicy]:
    """Pólizas activas del cliente. El BFF envía el id de la sesión, no uno elegido en el teléfono."""
    token = cliente_id.strip()
    if not token:
        raise _error(422, "cliente_obligatorio", _CLIENTE_OBLIGATORIO)
    return use_cases["list"].execute(token)


@router.get("", response_model=list[Policy])
def search_policies(q: str | None = None, cliente_id: Annotated[list[str] | None, Query()] = None) -> list[Policy]:
    """Consulta del portal: número de póliza (parcial) o clientes ya resueltos por el BFF."""
    return use_cases["search"].execute(q, cliente_id or [])


@router.get("/recientes", response_model=list[Policy])
def list_recent_policies(limite: Annotated[int, Query(ge=1, le=200)] = 100) -> list[Policy]:
    """Lectura interna para el back-office: las últimas pólizas de todos los canales."""
    return use_cases["recent"].execute(limite)


@router.get("/{poliza_id}", response_model=Policy)
def get_policy(poliza_id: str) -> Policy:
    """Lectura interna. El canal decide si quien pregunta es dueño de la póliza."""
    try:
        return use_cases["get"].execute(poliza_id)
    except PolicyNotFound as exc:
        raise _error(404, "poliza_no_encontrada", _POLIZA_NO_EXISTE) from exc


@router.get("/{poliza_id}/beneficiarios", response_model=list[Beneficiary])
def list_beneficiaries(poliza_id: str) -> list[Beneficiary]:
    try:
        return use_cases["get"].beneficiaries(poliza_id)
    except PolicyNotFound as exc:
        raise _error(404, "poliza_no_encontrada", _POLIZA_NO_EXISTE) from exc


@router.get("/{poliza_id}/endosos", response_model=list[Endorsement])
def list_endorsements(poliza_id: str) -> list[Endorsement]:
    try:
        return use_cases["endorse"].list(poliza_id)
    except PolicyNotFound as exc:
        raise _error(404, "poliza_no_encontrada", _POLIZA_NO_EXISTE) from exc


@router.post("/{poliza_id}/endosos", response_model=Endorsement, status_code=status.HTTP_201_CREATED)
def register_endorsement(poliza_id: str, request: EndorsementRequest) -> Endorsement:
    """Endoso de datos del asegurado. No escribe en Identidad: guarda ambas versiones y publica el evento."""
    try:
        return use_cases["endorse"].execute(poliza_id, request)
    except PolicyNotFound as exc:
        raise _error(404, "poliza_no_encontrada", _POLIZA_NO_EXISTE) from exc
    except PolicyNotEndorsable as exc:
        raise _error(409, "poliza_no_endosable", "La póliza no está activa y no admite endosos.") from exc
    except InvalidEndorsement as exc:
        raise _error(422, exc.codigo, exc.mensaje) from exc


@router.get("/{poliza_id}/renovacion/oferta", response_model=RenewalOffer)
def renewal_offer(poliza_id: str, x_cliente_id: Annotated[str, Header()]) -> RenewalOffer:
    """Oferta de solo lectura. El cliente llega en X-Cliente-Id, no en el cuerpo ni en la query."""
    cliente = x_cliente_id.strip()
    if not cliente:
        raise _error(422, "cliente_obligatorio", _CLIENTE_OBLIGATORIO)
    try:
        return use_cases["renewal_offer"].execute(poliza_id, cliente)
    except PolicyNotFound as exc:
        raise _error(404, "poliza_no_encontrada", _POLIZA_NO_EXISTE) from exc
    except PolicyNotRenewable as exc:
        raise _error(409, "poliza_no_renovable", "La póliza no está habilitada para renovar.") from exc


@router.post("/{poliza_id}/renovaciones", response_model=RenewalConfirmation, status_code=status.HTTP_201_CREATED)
def apply_renewal(
    poliza_id: str,
    request: RenewalRequest,
    response: Response,
    x_cliente_id: Annotated[str, Header()],
) -> RenewalConfirmation:
    """Aplica el ciclo cobrado. 201 la primera vez; 200 si ese cobro ya renovó la póliza."""
    cliente = x_cliente_id.strip()
    if not cliente:
        raise _error(422, "cliente_obligatorio", _CLIENTE_OBLIGATORIO)
    try:
        confirmation, created = call_upstream(use_cases["apply"].execute, poliza_id, cliente, request.cobro_id)
    except PolicyNotFound as exc:
        raise _error(404, "poliza_no_encontrada", _POLIZA_NO_EXISTE) from exc
    except PaymentNotApproved as exc:
        raise _error(409, "pago_no_aprobado", "El pago no está aprobado. La renovación no se aplicó.") from exc
    except PaymentDoesNotMatch as exc:
        raise _error(
            409,
            "pago_no_corresponde",
            "El pago no corresponde a esta renovación. La póliza no cambió.",
        ) from exc
    except RenewalAlreadyApplied as exc:
        raise _error(
            409,
            "renovacion_ya_aplicada",
            "Esta renovación ya fue aplicada. No se duplicó la cobertura ni hace falta otro pago.",
        ) from exc
    except PolicyNotRenewable as exc:
        raise _error(409, "poliza_no_renovable", "La póliza no está habilitada para renovar.") from exc
    if not created:
        response.status_code = status.HTTP_200_OK
    return confirmation


@router.post("/emisiones", response_model=Policy, status_code=status.HTTP_201_CREATED)
def issue_policy(request: IssuePolicyRequest, response: Response) -> Policy:
    """201 cuando emite; 200 cuando la clave o la cotización ya tenían póliza."""
    try:
        policy, created = call_upstream(use_cases["issue"].execute, request)
    except QuoteNotFound as exc:
        raise _error(404, "cotizacion_no_encontrada", "La cotización no existe.") from exc
    except QuoteExpired as exc:
        raise _error(
            409, "cotizacion_vencida", "La cotización venció antes de pagarse. No se emitió la póliza."
        ) from exc
    except PaymentNotApproved as exc:
        raise _error(
            409, "pago_no_aprobado", "El pago no está aprobado para esta cotización. No se emitió la póliza."
        ) from exc
    except IdempotencyKeyReused as exc:
        raise _error(409, "clave_reutilizada", "La clave de idempotencia ya se usó para otra cotización.") from exc
    if not created:
        response.status_code = status.HTTP_200_OK
    return policy
