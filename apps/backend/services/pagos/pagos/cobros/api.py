from fastapi import APIRouter, HTTPException
from solventa_common.db import build_engine
from solventa_common.errors import error_detail
from sqlalchemy.exc import DBAPIError, OperationalError

from pagos.cobros.adapters.pasarela import construir_pasarela
from pagos.cobros.adapters.repository import InMemoryCobroRepository, PostgresCobroRepository
from pagos.cobros.domain.models import Cobro, SolicitudCobro
from pagos.cobros.domain.ports import CobroRepository, PasarelaNoDisponible, PasarelaPort
from pagos.cobros.domain.use_cases import CobrarPrimaUseCase
from pagos.config import settings

router = APIRouter(prefix="/pagos", tags=["Cobros y Pagos"])

casos: dict = {}

RETRY_AFTER_S = 2


def wire(repository: CobroRepository, pasarela: PasarelaPort) -> None:
    if hasattr(repository, "create_schema"):
        repository.create_schema()
    casos["cobrar"] = CobrarPrimaUseCase(repository, pasarela)
    casos["repositorio"] = repository


def _default_wire() -> None:
    if settings.database_url:
        repository: CobroRepository = PostgresCobroRepository(build_engine(settings.database_url))
    else:
        repository = InMemoryCobroRepository()
    wire(repository, construir_pasarela())


_default_wire()


@router.get("/")
def info() -> dict:
    return {"component": "Cobros y Pagos"}


def _base_no_disponible(exc: DBAPIError) -> HTTPException:
    """During a database failover the client retries with the same idempotency key."""
    if not isinstance(exc, OperationalError) and not exc.connection_invalidated:
        raise exc
    return HTTPException(
        status_code=503,
        detail=error_detail("base_no_disponible", "El servicio de pagos no está disponible. Intenta de nuevo."),
        headers={"Retry-After": str(RETRY_AFTER_S)},
    )


@router.post("/cobros", response_model=Cobro)
def crear_cobro(solicitud: SolicitudCobro) -> Cobro:
    try:
        return casos["cobrar"].execute(solicitud)
    except PasarelaNoDisponible as exc:
        raise HTTPException(status_code=503, detail="Pasarela de pagos no disponible") from exc
    except DBAPIError as exc:
        raise _base_no_disponible(exc) from exc


@router.get("/cobros/{payment_id}", response_model=Cobro)
def get_payment(payment_id: str) -> Cobro:
    """Lectura interna: Pólizas confirma aquí que el cobro está aprobado antes de emitir."""
    try:
        payment = casos["repositorio"].get(payment_id)
    except DBAPIError as exc:
        raise _base_no_disponible(exc) from exc
    if payment is None:
        raise HTTPException(status_code=404, detail=error_detail("cobro_no_encontrado", "El cobro no existe."))
    return payment
