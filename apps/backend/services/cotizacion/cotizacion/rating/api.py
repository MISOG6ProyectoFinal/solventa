"""Cálculo de prima de una sola réplica. El canal no llama aquí: llama a /consenso."""

from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, status
from pydantic import ValidationError
from solventa_common.errors import error_detail
from solventa_common.validation import invalid_data_detail, invalid_fields

from cotizacion.container import container
from cotizacion.rating.domain.devolucion import Devolucion, SolicitudDevolucion, calcular_devolucion
from cotizacion.rating.domain.models import Cotizacion, parse_rating_request
from cotizacion.rating.domain.rating import ProductoNoTarifado, ReglasRating, RulesVersionAlreadyPublished

router = APIRouter(prefix="/cotizaciones", tags=["Cotización y Rating"])


@router.get("/")
def info() -> dict:
    return {"component": "Cotización y Rating", "reglas": container.rules.current().version}


@router.get("/reglas", response_model=ReglasRating)
def current_rules() -> ReglasRating:
    """Las reglas con las que se calcula hoy la prima."""
    return container.rules.current()


@router.get("/reglas/versiones", response_model=list[str])
def rules_versions() -> list[str]:
    return container.rules.versions()


@router.post("/reglas", response_model=ReglasRating, status_code=status.HTTP_201_CREATED)
def publish_rules(reglas: ReglasRating) -> ReglasRating:
    """Publica una versión nueva. Aplica desde la siguiente cotización, sin redesplegar."""
    try:
        container.rules.publish(reglas)
    except RulesVersionAlreadyPublished as exc:
        detail = error_detail("version_repetida", f"La versión de reglas ya existe: {reglas.version}")
        raise HTTPException(status.HTTP_409_CONFLICT, detail) from exc
    return reglas


@router.post("/calcular", response_model=Cotizacion)
def calcular(solicitud: Annotated[dict, Body()]) -> Cotizacion:
    try:
        return container.rate_quote.execute(parse_rating_request(solicitud))
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=invalid_data_detail(invalid_fields(exc))) from exc
    except ProductoNoTarifado as exc:
        raise HTTPException(status_code=422, detail=f"Producto sin tarifa: {exc}") from exc


@router.post("/devolucion", response_model=Devolucion)
def devolucion(solicitud: SolicitudDevolucion) -> Devolucion:
    """Prima no devengada (prorrateo por días) que se reintegra al cancelar una póliza."""
    return calcular_devolucion(solicitud)
