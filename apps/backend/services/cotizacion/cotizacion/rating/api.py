"""Cálculo de prima de una sola réplica. El canal no llama aquí: llama a /consenso."""

import socket
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException
from pydantic import ValidationError
from solventa_common.validation import invalid_data_detail, invalid_fields

from cotizacion.rating.domain.models import Cotizacion, parse_rating_request
from cotizacion.rating.domain.rating import REGLAS_VIGENTES, ProductoNoTarifado
from cotizacion.rating.domain.use_cases import CotizarUseCase

cotizar = CotizarUseCase(REGLAS_VIGENTES, instancia=socket.gethostname())
router = APIRouter(prefix="/cotizaciones", tags=["Cotización y Rating"])


@router.get("/")
def info() -> dict:
    return {"component": "Cotización y Rating", "reglas": REGLAS_VIGENTES.version}


@router.post("/calcular", response_model=Cotizacion)
def calcular(solicitud: Annotated[dict, Body()]) -> Cotizacion:
    try:
        return cotizar.execute(parse_rating_request(solicitud))
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=invalid_data_detail(invalid_fields(exc))) from exc
    except ProductoNoTarifado as exc:
        raise HTTPException(status_code=422, detail=f"Producto sin tarifa: {exc}") from exc
