"""Validador de Consenso: la réplica que recibe la solicitud la reparte entre las
tres réplicas (incluida ella misma) y responde con la oferta de negocio."""

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException

from cotizacion.catalogo.domain.models import (
    Canal,
    ProductoFueraCatalogoMobile,
    ProductoInactivo,
    ProductoNoDisponibleMobile,
    ProductoNoEncontrado,
)
from cotizacion.consenso.domain.consensus import SinConsenso
from cotizacion.consenso.domain.models import OfertaCotizacion
from cotizacion.container import container
from cotizacion.rating.domain.models import SolicitudRating
from cotizacion.rating.domain.rating import ProductoNoTarifado

router = APIRouter(prefix="/consenso", tags=["Validador de Consenso"])


@router.get("/")
def info() -> dict:
    from cotizacion.config import settings

    return {"component": "Validador de Consenso", "quorum": settings.quorum}


@router.post("/cotizaciones", response_model=OfertaCotizacion, response_model_exclude_none=True)
async def cotizar_con_consenso(
    solicitud: SolicitudRating,
    x_canal: Annotated[Canal, Header()],
    x_cliente_id: Annotated[str | None, Header()] = None,
) -> OfertaCotizacion:
    """El header X-Canal decide la disponibilidad comercial. No se reenvía a Rating."""
    try:
        return await container.cotizar_con_consenso.execute(solicitud, x_canal, x_cliente_id)
    except ProductoNoEncontrado as exc:
        raise HTTPException(status_code=404, detail=f"Producto no encontrado: {exc}") from exc
    except ProductoInactivo as exc:
        raise HTTPException(status_code=422, detail=f"Producto inactivo: {exc}") from exc
    except ProductoFueraCatalogoMobile as exc:
        raise HTTPException(status_code=422, detail=f"Producto fuera del catálogo móvil: {exc}") from exc
    except ProductoNoDisponibleMobile as exc:
        raise HTTPException(status_code=422, detail=f"Producto no disponible para cotización móvil: {exc}") from exc
    except ProductoNoTarifado as exc:
        raise HTTPException(status_code=422, detail=f"Producto sin tarifa: {exc}") from exc
    except SinConsenso as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail="Réplicas de cotización no disponibles") from exc


@router.get("/cotizaciones/{cotizacion_id}", response_model=OfertaCotizacion, response_model_exclude_none=True)
def obtener_cotizacion(cotizacion_id: str) -> OfertaCotizacion:
    """Lectura interna de la oferta persistida. El canal no reenvía el monto a cobrar."""
    oferta = container.cotizaciones.get(cotizacion_id)
    if oferta is None:
        raise HTTPException(status_code=404, detail=f"Cotización no encontrada: {cotizacion_id}")
    return oferta
