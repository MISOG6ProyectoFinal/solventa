from fastapi import APIRouter, HTTPException
from solventa_common.db import build_engine

from siniestros.avisos.adapters.memory import InMemoryAvisoRepository, InMemoryObjectStore
from siniestros.avisos.adapters.object_store import S3ObjectStore
from siniestros.avisos.adapters.repository import PostgresAvisoRepository
from siniestros.avisos.domain.errors import ReglaEvidencia
from siniestros.avisos.domain.models import Evidencia, NuevaCarga, NuevoAviso
from siniestros.avisos.domain.ports import AvisoRepository, ObjectStore
from siniestros.avisos.domain.use_cases import (
    ConfirmarCargaUseCase,
    CrearAvisoUseCase,
    ListarEvidenciasUseCase,
    SolicitarCargaUseCase,
)
from siniestros.config import settings

router = APIRouter(prefix="/siniestros", tags=["Siniestros"])

casos: dict = {}
object_store: ObjectStore


def wire(repository: AvisoRepository, almacen: ObjectStore, bucket: str | None = None) -> None:
    global object_store
    if hasattr(repository, "create_schema"):
        repository.create_schema()
    object_store = almacen
    name = bucket or settings.evidencias_bucket
    casos["crear"] = CrearAvisoUseCase(repository)
    casos["solicitar"] = SolicitarCargaUseCase(repository, almacen, name)
    casos["confirmar"] = ConfirmarCargaUseCase(repository, almacen)
    casos["listar"] = ListarEvidenciasUseCase(repository, almacen)


def _default_wire() -> None:
    if settings.persistent_stores:
        repository: AvisoRepository = PostgresAvisoRepository(build_engine(settings.database_url))
        almacen: ObjectStore = S3ObjectStore(settings.evidencias_bucket, settings.aws_region, None)
    else:
        repository = InMemoryAvisoRepository()
        almacen = InMemoryObjectStore()
    wire(repository, almacen)


def _http(exc: ReglaEvidencia) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.message)


def _evidencia_body(evidencia: Evidencia) -> dict:
    return {
        "id": evidencia.id,
        "url": evidencia.url,
        "content_type": evidencia.content_type,
        "bytes": evidencia.tamano,
        "estado": evidencia.estado,
    }


def _lista_body(item) -> dict:
    return {
        "id": item.id,
        "url": item.url,
        "content_type": item.content_type,
        "bytes": item.tamano,
        "estado": item.estado,
        "download_url": item.download_url,
    }


@router.get("/")
def info() -> dict:
    return {"component": "Siniestros"}


@router.post("/avisos", status_code=201)
def abrir_aviso(body: NuevoAviso) -> dict:
    try:
        created = casos["crear"].execute(
            poliza_id=body.poliza_id,
            tipo=body.tipo,
            ocurrido_en=body.ocurrido_en,
            descripcion=body.descripcion,
            ubicacion=body.ubicacion,
        )
    except ReglaEvidencia as exc:
        raise _http(exc) from exc
    return {"id": created.id, "estado": created.estado}


@router.post("/avisos/{aviso_id}/evidencias/cargas", status_code=201)
def solicitar_carga(aviso_id: str, body: NuevaCarga) -> dict:
    try:
        carga = casos["solicitar"].execute(aviso_id, body.content_type, body.tamano)
    except ReglaEvidencia as exc:
        raise _http(exc) from exc
    return {
        "evidencia_id": carga.evidencia_id,
        "upload_url": carga.upload_url,
        "headers": carga.headers,
        "expires_at": carga.expires_at,
    }


@router.post("/avisos/{aviso_id}/evidencias/{evidencia_id}/confirmar")
def confirmar_carga(aviso_id: str, evidencia_id: str) -> dict:
    try:
        evidencia = casos["confirmar"].execute(aviso_id, evidencia_id)
    except ReglaEvidencia as exc:
        raise _http(exc) from exc
    return _evidencia_body(evidencia)


@router.get("/avisos/{aviso_id}/evidencias")
def listar_evidencias(aviso_id: str) -> list[dict]:
    try:
        rows = casos["listar"].execute(aviso_id)
    except ReglaEvidencia as exc:
        raise _http(exc) from exc
    return [_lista_body(row) for row in rows]


_default_wire()
