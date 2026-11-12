from typing import Annotated

from fastapi import APIRouter, Body, Header, HTTPException, status
from starlette.concurrency import run_in_threadpool

from cotizacion.catalogo.domain.models import Canal, Producto, ProductoNoEncontrado
from cotizacion.consenso.api import invalid_request, product_error, quote_request
from cotizacion.consenso.domain.models import OfertaCotizacion
from cotizacion.consenso.domain.quote_contract import InvalidRequest, requested_product
from cotizacion.container import container
from cotizacion.gobierno_socios.domain.configuracion import (
    ActualizarConfiguracionRequest,
    CoberturaFueraDelRamo,
    ConfiguracionResponse,
    RamoFueraDelCanal,
    RamoHabilitado,
    RamoNoHabilitado,
)
from cotizacion.gobierno_socios.domain.embedded_quote import QuotableProduct
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
    TipoSocio,
)
from cotizacion.gobierno_socios.domain.quota import PartnerAuthorization, QuotaUpdateRequest, QuotaUsage

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
    ramos = {ramo.id: ramo for ramo in container.catalogo.list_ramos()}
    ramos_por_socio = container.configuraciones.ramos_por_socio()
    return [
        SocioResponse(
            **socio.model_dump(),
            ramos_habilitados=[
                RamoResumen(id=ramo_id, nombre=ramos[ramo_id].nombre)
                for ramo_id in sorted(ramos_por_socio.get(socio.id, []), key=lambda ramo_id: ramos[ramo_id].orden)
            ],
        )
        for socio in socios
    ]


def autorizar_ramo(socio: Socio, producto_id: str) -> RamoHabilitado:
    producto: Producto | None = container.catalogo.get_producto(producto_id)
    if producto is None:
        raise product_error(ProductoNoEncontrado(producto_id))
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


@router.get("/tipos", response_model=list[TipoSocio])
def list_partner_types() -> list[TipoSocio]:
    """Tipos de organización con que se da de alta un socio."""
    return list(TipoSocio)


@router.get("/alcances", response_model=list[Alcance])
def list_scopes() -> list[Alcance]:
    """Operaciones de la API pública que se pueden autorizar a un socio."""
    return list(Alcance)


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


@router.get("/socios/{socio_id}/consumo", response_model=QuotaUsage)
def quota_usage(socio_id: str) -> QuotaUsage:
    """Consumo del socio en la ventana actual frente a su cuota, para monitoreo."""
    try:
        return container.quota_usage.execute(socio_id)
    except SocioNoEncontrado as exc:
        raise _socio_no_encontrado() from exc


@router.put("/socios/{socio_id}/cuota", response_model=SocioResponse)
def update_quota(socio_id: str, solicitud: QuotaUpdateRequest) -> SocioResponse:
    """La nueva cuota aplica desde la siguiente llamada del socio."""
    try:
        socio = container.update_quota.execute(socio_id, solicitud.cuota_consumo)
    except SocioNoEncontrado as exc:
        raise _socio_no_encontrado() from exc
    return _vistas([socio])[0]


@router.get("/autorizacion", response_model=PartnerAuthorization)
def authorize_partner(
    alcance: Alcance,
    client_id: Annotated[str, Header(alias="X-Client-Id")],
    secreto: Annotated[str, Header(alias="X-Api-Key")],
) -> PartnerAuthorization:
    """Credencial, contrato y alcance; cuenta la llamada contra la cuota. Pasada la cuota, permitido es falso."""
    socio = autorizar_socio(client_id, secreto, alcance)
    return PartnerAuthorization(
        socio_id=socio.id,
        identificador=socio.identificador,
        nombre=socio.nombre,
        consumo=container.consume_quota.execute(socio),
    )


@router.get("/catalogo", response_model=list[QuotableProduct])
def partner_catalog(
    client_id: Annotated[str, Header(alias="X-Client-Id")],
    secreto: Annotated[str, Header(alias="X-Api-Key")],
) -> list[QuotableProduct]:
    """Lo que el socio puede cotizar: producto_id, coberturas habilitadas y el contrato de cada uno."""
    socio = autorizar_socio(client_id, secreto, Alcance.COTIZACION)
    return container.partner_catalog.execute(socio)


@router.post("/cotizaciones", response_model=OfertaCotizacion)
async def cotizar_como_socio(
    solicitud: Annotated[dict, Body()],
    client_id: Annotated[str, Header(alias="X-Client-Id")],
    secreto: Annotated[str, Header(alias="X-Api-Key")],
) -> OfertaCotizacion:
    """Cotización embebida (HU014): credencial y ramo del socio; el resto es la cotización de todos los canales."""
    socio = await run_in_threadpool(autorizar_socio, client_id, secreto, Alcance.COTIZACION)
    try:
        line = await run_in_threadpool(autorizar_ramo, socio, requested_product(solicitud))
    except InvalidRequest as exc:
        raise invalid_request(exc) from exc
    return await quote_request(solicitud, Canal.SOCIOS, allowed_coverages=set(line.coberturas), partner_id=socio.id)
