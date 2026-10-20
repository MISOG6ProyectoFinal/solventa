"""Modelos de dominio de Socios y Gobierno de API."""

from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field, StringConstraints

CONTRATO_VERSION_VIGENTE = "v2"
CUOTA_CONSUMO_INICIAL = 1000


class Alcance(StrEnum):
    COTIZACION = "cotizacion"
    EMISION = "emision"
    CONSULTA = "consulta"


class TipoSocio(StrEnum):
    BANCO = "Banco"
    AEROLINEA = "Aerolínea"
    ECOMMERCE = "E-commerce"
    FINTECH = "Fintech"
    RETAILER = "Retailer"


class EstadoContrato(StrEnum):
    ACTIVO = "Activo"
    SUSPENDIDO = "Suspendido"


class EstadoCredencial(StrEnum):
    ACTIVA = "Activa"
    REVOCADA = "Revocada"


def _sin_repetidos(alcances: list[Alcance]) -> list[Alcance]:
    return list(dict.fromkeys(alcances))


Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
# Se normaliza a mayúsculas: BANCO-AURORA y banco-aurora son el mismo socio.
Identificador = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z0-9][A-Za-z0-9-]{1,62}$"),
]
Correo = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"),
]


class AltaSocio(BaseModel):
    nombre: Texto
    identificador: Identificador
    tipo: TipoSocio
    pais: Texto = "Colombia"
    correo_contacto: Correo
    alcances: Annotated[list[Alcance], Field(min_length=1), AfterValidator(_sin_repetidos)]


class AltaSocioRequest(AltaSocio):
    # Mientras el portal no tenga autenticación, quien autoriza llega declarado en la solicitud.
    autorizado_por: Texto


class Socio(BaseModel):
    id: str
    nombre: str
    identificador: str
    tipo: TipoSocio
    pais: str
    correo_contacto: str
    alcances: list[Alcance]
    client_id: str
    secreto_hash: str
    secreto_enmascarado: str
    estado_credencial: EstadoCredencial = EstadoCredencial.ACTIVA
    estado_contrato: EstadoContrato = EstadoContrato.ACTIVO
    version_contrato: str = CONTRATO_VERSION_VIGENTE
    cuota_consumo: int = CUOTA_CONSUMO_INICIAL
    alta_fecha: datetime
    alta_usuario: str


class AuthorizedPartner(BaseModel):
    """Lo que otros servicios necesitan del socio que ya pasó credencial, contrato y alcance."""

    socio_id: str
    identificador: str
    nombre: str


class RamoResumen(BaseModel):
    id: str
    nombre: str


class SocioResponse(BaseModel):
    """Vista del socio para el portal. Nunca incluye el secreto ni su hash."""

    id: str
    nombre: str
    identificador: str
    tipo: TipoSocio
    pais: str
    correo_contacto: str
    alcances: list[Alcance]
    client_id: str
    secreto_enmascarado: str
    estado_credencial: EstadoCredencial
    estado_contrato: EstadoContrato
    version_contrato: str
    cuota_consumo: int
    alta_fecha: datetime
    alta_usuario: str
    ramos_habilitados: list[RamoResumen] = Field(default_factory=list)


class SocioCreadoResponse(SocioResponse):
    """Respuesta del alta: única vez que el secreto viaja en claro."""

    secreto: str


class IdentificadorDuplicado(ValueError):
    pass


class SocioNoEncontrado(LookupError):
    pass


class CredencialInvalida(PermissionError):
    pass


class ContratoSuspendido(PermissionError):
    pass


class AlcanceNoAutorizado(PermissionError):
    pass
