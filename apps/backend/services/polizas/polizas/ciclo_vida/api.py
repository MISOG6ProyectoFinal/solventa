from fastapi import APIRouter, HTTPException, Response, status
from solventa_common.db import build_engine
from solventa_common.integration import ServiceClient
from solventa_common.integration.base import call_upstream

from polizas.ciclo_vida.adapters.repository import InMemoryPolicyRepository, PostgresPolicyRepository
from polizas.ciclo_vida.adapters.upstream import PaymentReader, QuoteReader
from polizas.ciclo_vida.domain.models import IssuePolicyRequest, Policy
from polizas.ciclo_vida.domain.ports import (
    IdempotencyKeyReused,
    PaymentNotApproved,
    PaymentSource,
    PolicyRepository,
    QuoteExpired,
    QuoteNotFound,
    QuoteSource,
)
from polizas.ciclo_vida.domain.use_cases import IssuePolicyUseCase, ListClientPoliciesUseCase
from polizas.config import settings

router = APIRouter(prefix="/polizas", tags=["Pólizas y Ciclo de Vida"])

use_cases: dict = {}


def wire(policies: PolicyRepository, quotes: QuoteSource, payments: PaymentSource) -> None:
    if hasattr(policies, "create_schema"):
        policies.create_schema()
    use_cases["issue"] = IssuePolicyUseCase(policies, quotes, payments)
    use_cases["list"] = ListClientPoliciesUseCase(policies)


def _default_wire() -> None:
    if settings.database_url:
        policies: PolicyRepository = PostgresPolicyRepository(build_engine(settings.database_url))
    else:
        policies = InMemoryPolicyRepository()
    quotes = QuoteReader(ServiceClient("cotizacion", settings.cotizacion_url))
    payments = PaymentReader(ServiceClient("pagos", settings.pagos_url))
    wire(policies, quotes, payments)


_default_wire()


def _error(code: int, codigo: str, mensaje: str) -> HTTPException:
    return HTTPException(code, {"codigo": codigo, "mensaje": mensaje})


@router.get("/")
def info() -> dict:
    return {"component": "Pólizas y Ciclo de Vida"}


@router.get("/clientes/{cliente_id}", response_model=list[Policy])
def list_client_policies(cliente_id: str) -> list[Policy]:
    """Pólizas activas del cliente. El BFF envía el id de la sesión, no uno elegido en el teléfono."""
    token = cliente_id.strip()
    if not token:
        raise _error(422, "cliente_obligatorio", "El cliente es obligatorio.")
    return use_cases["list"].execute(token)


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
