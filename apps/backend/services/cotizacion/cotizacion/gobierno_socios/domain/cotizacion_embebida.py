"""Contrato de la cotización embebida: qué datos pide cada producto al socio (HU014)."""

from decimal import Decimal
from typing import cast

from pydantic import BaseModel, ValidationError

from cotizacion.rating.domain.models import (
    SolicitudCotizacion,
    SolicitudCotizacionMicroseguroVida,
    SolicitudCotizacionParametrico,
    SolicitudCotizacionViaje,
    SolicitudCotizacionVidaHipotecario,
    SolicitudRating,
)
from cotizacion.senales.domain.models import ConsentimientoOpenFinance

# Solventa resuelve el score; el socio no lo puede fijar.
CAMPOS_DEL_SERVIDOR = ("score_riesgo",)


class SolicitudSocioVidaHipotecario(SolicitudCotizacionVidaHipotecario):
    consentimiento_open_finance: ConsentimientoOpenFinance | None = None


CONTRATOS: dict[str, type[BaseModel]] = {
    "viaje-internacional": SolicitudCotizacionViaje,
    "vida-esencial": SolicitudCotizacionMicroseguroVida,
    "parametrico-clima-vuelo": SolicitudCotizacionParametrico,
    "vida-hipotecario": SolicitudSocioVidaHipotecario,
}

_MENSAJES = {
    "missing": "Campo obligatorio",
    "greater_than": "Debe ser mayor que {gt}",
    "greater_than_equal": "Debe ser mayor o igual que {ge}",
    "less_than_equal": "Debe ser menor o igual que {le}",
    "literal_error": "Valor no permitido. Opciones: {expected}",
    "string_too_short": "No puede estar vacío",
    "string_too_long": "Supera la longitud máxima",
}


class DatosInvalidos(ValueError):
    def __init__(self, campos: list[dict[str, str]]) -> None:
        self.campos = campos
        super().__init__(campos)


def _mensaje(error: dict) -> str:
    tipo = error["type"]
    if tipo in _MENSAJES:
        return _MENSAJES[tipo].format(**error.get("ctx", {}))
    if tipo == "value_error":
        return str(error["msg"]).removeprefix("Value error, ")
    if tipo.endswith("_parsing") or tipo.endswith("_type"):
        return "Formato inválido"
    return "Valor inválido"


def _campos(exc: ValidationError) -> list[dict[str, str]]:
    return [
        {"campo": ".".join(str(parte) for parte in error["loc"]) or "solicitud", "error": _mensaje(error)}
        for error in exc.errors()
    ]


def producto_solicitado(datos: dict) -> str:
    producto_id = datos.get("producto_id")
    if not isinstance(producto_id, str) or not producto_id.strip():
        raise DatosInvalidos([{"campo": "producto_id", "error": "Campo obligatorio"}])
    return producto_id.strip()


def validar_contrato(datos: dict) -> BaseModel:
    """Valida contra el contrato del producto. Lanza DatosInvalidos con cada campo y su motivo."""
    limpio = {clave: valor for clave, valor in datos.items() if clave not in CAMPOS_DEL_SERVIDOR}
    contrato = CONTRATOS.get(producto_solicitado(datos), SolicitudCotizacion)
    try:
        return contrato.model_validate(limpio)
    except ValidationError as exc:
        raise DatosInvalidos(_campos(exc)) from exc


def solicitud_de_rating(contrato: BaseModel, score_riesgo: Decimal | None = None) -> SolicitudRating:
    """Quita lo que es del canal y deja solo lo que calcula Rating."""
    if isinstance(contrato, SolicitudSocioVidaHipotecario):
        datos = contrato.model_dump(exclude={"consentimiento_open_finance"})
        if score_riesgo is not None:
            datos["score_riesgo"] = score_riesgo
        return SolicitudCotizacionVidaHipotecario(**datos)
    return cast(SolicitudRating, contrato)
