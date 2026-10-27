"""Consulta los prestadores de asistencia más cercanos a un punto, como GeoJSON."""

from typing import Annotated

from fastapi import APIRouter, Query
from solventa_common.db import build_engine

from siniestros.config import settings
from siniestros.prestadores.adapters.memory import InMemoryPrestadorRepository
from siniestros.prestadores.adapters.postgis import PostgisPrestadorRepository
from siniestros.prestadores.adapters.seed_catalog import SeedCatalog
from siniestros.prestadores.domain.models import ConsultaCercanos, PrestadorCercano
from siniestros.prestadores.domain.ports import CatalogSource, PrestadorRepository
from siniestros.prestadores.domain.use_cases import BuscarCercanosUseCase, SincronizarCatalogoUseCase

router = APIRouter(prefix="/siniestros/prestadores", tags=["Prestadores de asistencia"])

casos: dict = {}


def wire(repository: PrestadorRepository, sources: list[CatalogSource]) -> None:
    """Loads `sources` into the repository now. Postgres gets its catalog from the sync command instead."""
    if hasattr(repository, "create_schema"):
        repository.create_schema()
    SincronizarCatalogoUseCase(repository, sources).execute()
    casos["cercanos"] = BuscarCercanosUseCase(repository)


def _default_wire() -> None:
    if settings.persistent_stores:
        wire(PostgisPrestadorRepository(build_engine(settings.database_url)), [])
    else:
        wire(InMemoryPrestadorRepository(), [SeedCatalog()])


def _feature(item: PrestadorCercano) -> dict:
    prestador = item.prestador
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [prestador.longitud, prestador.latitud]},
        "properties": {
            "id": prestador.id,
            "nombre": prestador.nombre,
            "tipo": prestador.tipo,
            "distancia_km": round(item.distancia_km, 1),
            "eta_min": item.eta_min,
            "calificacion": prestador.calificacion,
        },
    }


@router.get("/cercanos")
def prestadores_cercanos(consulta: Annotated[ConsultaCercanos, Query()]) -> dict:
    return {"type": "FeatureCollection", "features": [_feature(item) for item in casos["cercanos"].execute(consulta)]}


_default_wire()
