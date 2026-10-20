from typing import Annotated

from fastapi import APIRouter, Body, Header, HTTPException, status
from starlette.concurrency import run_in_threadpool

from cotizacion.catalogo.domain.catalogo_socios import RAMOS_CANAL_SOCIOS
from cotizacion.catalogo.domain.models import Canal, Producto
from cotizacion.consenso.api import cotizar
from cotizacion.consenso.domain.models import OfertaCotizacion
from cotizacion.container import container
from cotizacion.gobierno_socios.domain.configuracion import (
    ActualizarConfiguracionRequest,
    CoberturaFueraDelRamo,
    ConfiguracionResponse,
    RamoFueraDelCanal,
    RamoHabilitado,
    RamoNoHabilitado,
)
from cotizacion.gobierno_socios.domain.cotizacion_embebida import (
    DatosInvalidos,
    ProductoCotizable,
    SolicitudSocioVidaHipotecario,
    producto_solicitado,
    solicitud_de_rating,
    validar_contrato,
)
from cotizacion.gobierno_socios.domain.models import (
    Alcance,
    AlcanceNoAutorizado,
    AltaSocio,
    AltaSocioRequest,
    ContratoSuspendido,
    CredencialInvalida,
    IdentificadorDuplicado,
    RamoResumen,
    Socio,
    SocioCreadoResponse,
    SocioNoEncontrado,
    SocioResponse,
)
from cotizacion.senales.domain.models import SenalAplicada

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


def _socio_no_encontrado() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, _error("socio_no_encontrado", "El socio no existe."))


def _vistas(socios: list[Socio]) -> list[SocioResponse]:
    nombres = {ramo.id: ramo.nombre for ramo in container.catalogo.list_ramos()}
    ramos_por_socio = container.configuraciones.ramos_por_socio()
    return [
        SocioResponse(
            **socio.model_dump(),
            ramos_habilitados=[
                RamoResumen(id=ramo_id, nombre=nombres.get(ramo_id, ramo_id))
                for ramo_id in sorted(ramos_por_socio.get(socio.id, []), key=RAMOS_CANAL_SOCIOS.index)
            ],
        )
        for socio in socios
    ]


def autorizar_ramo(socio: Socio, producto_id: str) -> RamoHabilitado:
    producto: Producto | None = container.catalogo.get_producto(producto_id)
    if producto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Producto no encontrado: {producto_id}")
    try:
        return container.autorizar_ramo.execute(socio, producto)
    except RamoNoHabilitado as exc:
        ramo = container.catalogo.get_ramo(producto.ramo_id)
        nombre = ramo.nombre if ramo else producto.ramo_id
        detail = _error("ramo_no_habilitado", f"El ramo '{nombre}' no está habilitado para este socio.")
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
def listar_socios() -> list[SocioResponse]:
    return _vistas(container.consultar_socios.listar())


@router.get("/socios/{socio_id}", response_model=SocioResponse)
def obtener_socio(socio_id: str) -> SocioResponse:
    try:
        return _vistas([container.consultar_socios.obtener(socio_id)])[0]
    except SocioNoEncontrado as exc:
        raise _socio_no_encontrado() from exc


@router.get("/socios/{socio_id}/configuracion", response_model=ConfiguracionResponse)
def consultar_configuracion(socio_id: str) -> ConfiguracionResponse:
    try:
        return container.consultar_configuracion.execute(socio_id)
    except SocioNoEncontrado as exc:
        raise _socio_no_encontrado() from exc


@router.put("/socios/{socio_id}/configuracion", response_model=ConfiguracionResponse)
def actualizar_configuracion(socio_id: str, solicitud: ActualizarConfiguracionRequest) -> ConfiguracionResponse:
    try:
        configuracion = container.actualizar_configuracion.execute(socio_id, solicitud.ramos, solicitud.actualizado_por)
    except SocioNoEncontrado as exc:
        raise _socio_no_encontrado() from exc
    except RamoFueraDelCanal as exc:
        detail = _error("ramo_fuera_del_canal", f"El ramo '{exc}' no pertenece al canal de socios.")
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail) from exc
    except CoberturaFueraDelRamo as exc:
        detail = _error("cobertura_fuera_del_ramo", f"La cobertura '{exc}' no pertenece al ramo indicado.")
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail) from exc
    return container.consultar_configuracion.presentar(configuracion)


@router.get("/catalogo", response_model=list[ProductoCotizable])
def catalogo_del_socio(
    client_id: Annotated[str, Header(alias="X-Client-Id")],
    secreto: Annotated[str, Header(alias="X-Api-Key")],
) -> list[ProductoCotizable]:
    """Lo que el socio puede cotizar: producto_id, coberturas habilitadas y el contrato de cada uno."""
    socio = autorizar_socio(client_id, secreto, Alcance.COTIZACION)
    return container.consultar_catalogo_socio.execute(socio)


def _datos_invalidos(exc: DatosInvalidos) -> HTTPException:
    detail = _error("datos_invalidos", "La solicitud tiene datos faltantes o inválidos. No se calculó la prima.")
    return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {**detail, "campos": exc.campos})


@router.post("/cotizaciones", response_model=OfertaCotizacion)
async def cotizar_como_socio(
    solicitud: Annotated[dict, Body()],
    client_id: Annotated[str, Header(alias="X-Client-Id")],
    secreto: Annotated[str, Header(alias="X-Api-Key")],
) -> OfertaCotizacion:
    """Cotización embebida (HU014): credencial, ramo y contrato se validan antes de calcular."""
    socio = await run_in_threadpool(autorizar_socio, client_id, secreto, Alcance.COTIZACION)
    try:
        ramo = await run_in_threadpool(autorizar_ramo, socio, producto_solicitado(solicitud))
        contrato = validar_contrato(solicitud)
    except DatosInvalidos as exc:
        raise _datos_invalidos(exc) from exc
    senales: list[SenalAplicada] = []
    if isinstance(contrato, SolicitudSocioVidaHipotecario) and contrato.consentimiento_open_finance:
        senales.append(await run_in_threadpool(container.resolver_score.execute, contrato.consentimiento_open_finance))
    rating = solicitud_de_rating(contrato, senales[0].score_riesgo if senales else None)
    return await cotizar(rating, Canal.SOCIOS, senales=senales, coberturas_permitidas=set(ramo.coberturas))
