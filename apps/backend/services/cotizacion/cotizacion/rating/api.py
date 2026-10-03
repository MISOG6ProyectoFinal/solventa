"""Cálculo de prima de una sola réplica. El canal no llama aquí: llama a /consenso."""

import socket

from fastapi import APIRouter, HTTPException

from cotizacion.rating.domain.models import Cotizacion, SolicitudCotizacion
from cotizacion.rating.domain.rating import REGLAS_VIGENTES, ProductoNoTarifado
from cotizacion.rating.domain.use_cases import CotizarUseCase

cotizar = CotizarUseCase(REGLAS_VIGENTES, instancia=socket.gethostname())
router = APIRouter(prefix="/cotizaciones", tags=["Cotización y Rating"])


@router.get("/")
def info() -> dict:
    return {"component": "Cotización y Rating", "reglas": REGLAS_VIGENTES.version}


@router.post("/calcular", response_model=Cotizacion)
def calcular(solicitud: SolicitudCotizacion) -> Cotizacion:
    try:
        return cotizar.execute(solicitud)
    except ProductoNoTarifado as exc:
        raise HTTPException(status_code=422, detail=f"Producto sin tarifa: {exc}") from exc
