"""Validador de Consenso: la réplica que recibe la solicitud la reparte entre las
tres réplicas (incluida ella misma) y responde con la oferta de negocio."""

from typing import Annotated

from fastapi import APIRouter, Body, Header, HTTPException, status
from solventa_common.validation import invalid_data_detail
from starlette.concurrency import run_in_threadpool

from cotizacion.catalogo.domain.models import (
    Canal,
    ProductNotInChannel,
    Producto,
    ProductoInactivo,
    ProductoNoEncontrado,
)
from cotizacion.consenso.domain.consensus import SinConsenso
from cotizacion.consenso.domain.models import OfertaCotizacion
from cotizacion.consenso.domain.quote_contract import (
    InvalidRequest,
    open_finance_consent,
    requested_product,
    to_rating_request,
    validate_contract,
)
from cotizacion.container import container
from cotizacion.rating.domain.rating import ProductoNoTarifado
from cotizacion.signals.domain.models import AppliedSignal

router = APIRouter(prefix="/consenso", tags=["Validador de Consenso"])

_PRODUCT_ERRORS: dict[type[Exception], tuple[int, str, str]] = {
    ProductoNoEncontrado: (status.HTTP_404_NOT_FOUND, "producto_no_encontrado", "Producto no encontrado"),
    ProductoInactivo: (status.HTTP_422_UNPROCESSABLE_ENTITY, "producto_inactivo", "Producto inactivo"),
    ProductNotInChannel: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "producto_fuera_del_canal",
        "Producto no ofrecido en el canal",
    ),
    ProductoNoTarifado: (status.HTTP_422_UNPROCESSABLE_ENTITY, "producto_sin_tarifa", "Producto sin tarifa"),
}


def _error(status_code: int, codigo: str, mensaje: str) -> HTTPException:
    return HTTPException(status_code, {"codigo": codigo, "mensaje": mensaje})


def invalid_request(exc: InvalidRequest) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, invalid_data_detail(exc.fields))


def product_error(exc: Exception) -> HTTPException:
    status_code, codigo, prefix = _PRODUCT_ERRORS[type(exc)]
    return _error(status_code, codigo, f"{prefix}: {exc}")


@router.get("/")
def info() -> dict:
    from cotizacion.config import settings

    return {"component": "Validador de Consenso", "quorum": settings.quorum}


@router.post("/cotizaciones", response_model=OfertaCotizacion, response_model_exclude_none=True)
async def cotizar_con_consenso(
    solicitud: Annotated[dict, Body()],
    x_canal: Annotated[Canal, Header()],
    x_cliente_id: Annotated[str | None, Header()] = None,
) -> OfertaCotizacion:
    """El header X-Canal decide la disponibilidad comercial y X-Cliente-Id el dueño de la oferta.
    Ninguno de los dos se reenvía a Rating."""
    return await quote_request(solicitud, x_canal, x_cliente_id)


async def quote_request(
    data: dict,
    canal: Canal,
    client_id: str | None = None,
    allowed_coverages: set[str] | None = None,
    partner_id: str | None = None,
) -> OfertaCotizacion:
    """La misma cotización para todos los canales: producto, contrato, señales y consenso."""
    try:
        product: Producto = await run_in_threadpool(
            container.validar_producto_canal.execute, requested_product(data), canal
        )
        contract = validate_contract(data)
    except InvalidRequest as exc:
        raise invalid_request(exc) from exc
    except tuple(_PRODUCT_ERRORS) as exc:
        raise product_error(exc) from exc
    signals: list[AppliedSignal] = []
    consent = open_finance_consent(contract)
    if consent:
        signals.append(await run_in_threadpool(container.resolve_risk_profile.execute, consent))
    rating = to_rating_request(contract, signals[0].score_riesgo if signals else None)
    try:
        return await container.cotizar_con_consenso.execute(
            rating, product, canal, client_id, signals, allowed_coverages, partner_id
        )
    except ProductoNoTarifado as exc:
        raise product_error(exc) from exc
    except SinConsenso as exc:
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "sin_consenso", str(exc)) from exc
    except OSError as exc:
        raise _error(
            status.HTTP_503_SERVICE_UNAVAILABLE, "replicas_no_disponibles", "Réplicas de cotización no disponibles"
        ) from exc


@router.get("/cotizaciones/{cotizacion_id}", response_model=OfertaCotizacion, response_model_exclude_none=True)
def obtener_cotizacion(cotizacion_id: str) -> OfertaCotizacion:
    """Lectura interna de la oferta persistida. El canal no reenvía el monto a cobrar."""
    oferta = container.cotizaciones.get(cotizacion_id)
    if oferta is None:
        raise HTTPException(status_code=404, detail=f"Cotización no encontrada: {cotizacion_id}")
    return oferta
