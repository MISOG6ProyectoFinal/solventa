from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from cotizacion.catalogo.domain.models import Canal
from cotizacion.consenso.api import cotizar_con_consenso
from cotizacion.consenso.domain.models import OfertaCotizacion
from cotizacion.container import container
from cotizacion.gobierno_socios.domain.models import (
    Alcance,
    AlcanceNoAutorizado,
    AltaSocio,
    AltaSocioRequest,
    ContratoSuspendido,
    CredencialInvalida,
    IdentificadorDuplicado,
    Socio,
    SocioCreadoResponse,
    SocioNoEncontrado,
    SocioResponse,
)
from cotizacion.rating.domain.models import SolicitudRating

router = APIRouter(prefix="/gobierno-socios", tags=["Socios y Gobierno de API"])


def _error(codigo: str, mensaje: str) -> dict:
    return {"codigo": codigo, "mensaje": mensaje}


def autorizar_socio(client_id: str, secreto: str, alcance: Alcance) -> Socio:
    try:
        return container.autorizar_socio.execute(client_id, secreto, alcance)
    except CredencialInvalida as exc:
        detail = _error("credencial_invalida", "Las credenciales del socio no son válidas.")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail) from exc
    except ContratoSuspendido as exc:
        detail = _error("contrato_suspendido", "El contrato de API del socio está suspendido.")
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail) from exc
    except AlcanceNoAutorizado as exc:
        detail = _error("alcance_no_autorizado", f"El alcance del socio no incluye la operación '{alcance}'.")
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail) from exc


@router.get("/")
def info() -> dict:
    return {"component": "Socios y Gobierno de API"}


@router.post("/socios", response_model=SocioCreadoResponse, status_code=status.HTTP_201_CREATED)
def dar_de_alta(solicitud: AltaSocioRequest) -> SocioCreadoResponse:
    alta = AltaSocio(**solicitud.model_dump(exclude={"autorizado_por"}))
    try:
        socio, secreto = container.dar_de_alta_socio.execute(alta, solicitud.autorizado_por)
    except IdentificadorDuplicado as exc:
        detail = _error(
            "identificador_duplicado",
            "Ya existe un socio con este identificador. No es posible crearlo de nuevo.",
        )
        raise HTTPException(status.HTTP_409_CONFLICT, detail) from exc
    return SocioCreadoResponse(**socio.model_dump(), secreto=secreto)


@router.get("/socios", response_model=list[SocioResponse])
def listar_socios() -> list[Socio]:
    return container.consultar_socios.listar()


@router.get("/socios/{socio_id}", response_model=SocioResponse)
def obtener_socio(socio_id: str) -> Socio:
    try:
        return container.consultar_socios.obtener(socio_id)
    except SocioNoEncontrado as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _error("socio_no_encontrado", "El socio no existe.")) from exc


@router.post("/cotizaciones", response_model=OfertaCotizacion)
async def cotizar_como_socio(
    solicitud: SolicitudRating,
    client_id: Annotated[str, Header(alias="X-Client-Id")],
    secreto: Annotated[str, Header(alias="X-Api-Key")],
) -> OfertaCotizacion:
    """Cotización del canal embebido: primero reconoce al socio y su alcance."""
    autorizar_socio(client_id, secreto, Alcance.COTIZACION)
    return await cotizar_con_consenso(solicitud, Canal.SOCIOS)
