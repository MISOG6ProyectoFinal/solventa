from fastapi import APIRouter, HTTPException
from solventa_common.db import build_engine

from pagos.cobros.adapters.pasarela import construir_pasarela
from pagos.cobros.adapters.repository import InMemoryCobroRepository, PostgresCobroRepository
from pagos.cobros.domain.models import Cobro, SolicitudCobro
from pagos.cobros.domain.ports import CobroRepository, PasarelaNoDisponible, PasarelaPort
from pagos.cobros.domain.use_cases import CobrarPrimaUseCase
from pagos.config import settings

router = APIRouter(prefix="/pagos", tags=["Cobros y Pagos"])

casos: dict = {}


def wire(repository: CobroRepository, pasarela: PasarelaPort) -> None:
    if hasattr(repository, "create_schema"):
        repository.create_schema()
    casos["cobrar"] = CobrarPrimaUseCase(repository, pasarela)


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


@router.post("/cobros", response_model=Cobro)
def crear_cobro(solicitud: SolicitudCobro) -> Cobro:
    try:
        return casos["cobrar"].execute(solicitud)
    except PasarelaNoDisponible as exc:
        raise HTTPException(status_code=503, detail="Pasarela de pagos no disponible") from exc
