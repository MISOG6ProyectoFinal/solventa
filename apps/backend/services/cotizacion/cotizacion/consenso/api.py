"""Validador de Consenso: la réplica que recibe la solicitud la reparte entre las
tres réplicas (incluida ella misma) y responde con la oferta de negocio."""

from fastapi import APIRouter, HTTPException

from cotizacion.catalogo.domain.models import (
    ProductoInactivo,
    ProductoNoDisponibleMobile,
    ProductoNoEncontrado,
)
from cotizacion.consenso.domain.consensus import SinConsenso
from cotizacion.consenso.domain.models import OfertaCotizacion
from cotizacion.container import container
from cotizacion.rating.domain.models import SolicitudCotizacion
from cotizacion.rating.domain.rating import ProductoNoTarifado

router = APIRouter(prefix="/consenso", tags=["Validador de Consenso"])


@router.get("/")
def info() -> dict:
    from cotizacion.config import settings

    return {"component": "Validador de Consenso", "quorum": settings.quorum}


@router.post("/cotizaciones", response_model=OfertaCotizacion)
async def cotizar_con_consenso(solicitud: SolicitudCotizacion) -> OfertaCotizacion:
    try:
        return await container.cotizar_con_consenso.execute(solicitud)
    except ProductoNoEncontrado as exc:
        raise HTTPException(status_code=404, detail=f"Producto no encontrado: {exc}") from exc
    except (ProductoInactivo, ProductoNoDisponibleMobile) as exc:
        raise HTTPException(status_code=422, detail=f"Producto no disponible para cotización móvil: {exc}") from exc
    except ProductoNoTarifado as exc:
        raise HTTPException(status_code=422, detail=f"Producto sin tarifa: {exc}") from exc
    except SinConsenso as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail="Réplicas de cotización no disponibles") from exc
