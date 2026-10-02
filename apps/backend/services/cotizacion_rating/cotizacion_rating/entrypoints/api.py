"""Entrada HTTP de Cotización y Rating.

Corre con 3 réplicas detrás de un Service headless; el Validador de Consenso
llama a cada réplica y se queda con el resultado mayoritario.
"""

import socket

from fastapi import APIRouter, HTTPException
from solventa_common.app import create_app
from solventa_common.db import optional_engine, readiness_checks

from cotizacion_rating.config import settings
from cotizacion_rating.domain.models import Cotizacion, SolicitudCotizacion
from cotizacion_rating.domain.rating import REGLAS_VIGENTES, ProductoNoTarifado
from cotizacion_rating.domain.use_cases import CotizarUseCase

engine = optional_engine(settings.database_url)
cotizar = CotizarUseCase(REGLAS_VIGENTES, instancia=socket.gethostname())
router = APIRouter(prefix="/cotizaciones", tags=["cotizacion-rating"])


@router.get("/")
def info() -> dict:
    return {"service": settings.service_name, "capability": "Cotización y Rating", "reglas": REGLAS_VIGENTES.version}


@router.post("/calcular", response_model=Cotizacion)
def calcular(solicitud: SolicitudCotizacion) -> Cotizacion:
    try:
        return cotizar.execute(solicitud)
    except ProductoNoTarifado as exc:
        raise HTTPException(status_code=422, detail=f"Producto sin tarifa: {exc}") from exc


app = create_app(settings, routers=[router], readiness_checks=readiness_checks(engine))
