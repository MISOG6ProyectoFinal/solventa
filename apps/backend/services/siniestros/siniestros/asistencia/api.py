"""Pide asistencia en sitio para un aviso radicado y publica el despacho en el bus."""

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException
from solventa_common.db import build_engine
from solventa_common.events import EventPublisher

from siniestros.asistencia.adapters.dispatcher import PrototypeDispatcher
from siniestros.asistencia.adapters.memory import InMemoryAsistenciaRepository
from siniestros.asistencia.adapters.repository import PostgresAsistenciaRepository
from siniestros.asistencia.domain.errors import ReglaAsistencia
from siniestros.asistencia.domain.models import Asistencia, NuevaAsistencia
from siniestros.asistencia.domain.ports import AsistenciaRepository, AssistanceDispatcher
from siniestros.asistencia.domain.use_cases import ListarAsistenciasUseCase, SolicitarAsistenciaUseCase
from siniestros.avisos import api as avisos_api
from siniestros.avisos.domain.ports import AvisoRepository
from siniestros.config import settings
from siniestros.parametrico.adapters.bus import build_publisher

router = APIRouter(prefix="/siniestros", tags=["Asistencia en sitio"])

casos: dict = {}


def wire(
    avisos: AvisoRepository,
    repository: AsistenciaRepository,
    publisher: EventPublisher,
    dispatcher: AssistanceDispatcher,
) -> None:
    if hasattr(repository, "create_schema"):
        repository.create_schema()
    casos["solicitar"] = SolicitarAsistenciaUseCase(avisos, repository, dispatcher, publisher)
    casos["listar"] = ListarAsistenciasUseCase(avisos, repository)


def _default_wire() -> None:
    if settings.persistent_stores:
        repository: AsistenciaRepository = PostgresAsistenciaRepository(build_engine(settings.database_url))
    else:
        repository = InMemoryAsistenciaRepository()
    wire(avisos_api.repository, repository, build_publisher(), PrototypeDispatcher())


def _http(exc: ReglaAsistencia) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.message)


@router.get("/asistencias")
def info() -> dict:
    return {"component": "Asistencia en sitio"}


@router.post("/avisos/{aviso_id}/asistencias", status_code=201)
def solicitar_asistencia(aviso_id: str, body: NuevaAsistencia, x_cliente_id: Annotated[str, Header()]) -> Asistencia:
    try:
        return casos["solicitar"].execute(aviso_id, body, cliente_id=x_cliente_id)
    except ReglaAsistencia as exc:
        raise _http(exc) from exc


@router.get("/avisos/{aviso_id}/asistencias")
def listar_asistencias(aviso_id: str, x_cliente_id: Annotated[str, Header()]) -> list[Asistencia]:
    try:
        return casos["listar"].execute(aviso_id, cliente_id=x_cliente_id)
    except ReglaAsistencia as exc:
        raise _http(exc) from exc


_default_wire()
