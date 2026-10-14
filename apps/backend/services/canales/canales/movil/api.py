from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator
from solventa_common.integration.base import call_upstream
from solventa_common.sesion import InvalidToken, verify_token

from canales.clients import cotizacion, identidad, siniestros
from canales.config import settings

router = APIRouter(prefix="/movil", tags=["BFF Móvil"])


class SolicitudCotizacionMovil(BaseModel):
    producto_id: str
    nombre: str
    cedula: str
    destino: Literal["Estados Unidos", "España", "México", "Otro país"]
    fecha_salida: date
    fecha_regreso: date
    viajeros: int = Field(ge=1)

    @field_validator("nombre")
    @classmethod
    def _nombre_obligatorio(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El nombre es obligatorio")
        return value.strip()

    @field_validator("cedula")
    @classmethod
    def _cedula_numerica(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("La cédula es obligatoria")
        if not value.isdigit():
            raise ValueError("La cédula debe contener solo dígitos")
        return value

    @model_validator(mode="after")
    def _fechas_validas(self) -> "SolicitudCotizacionMovil":
        if self.fecha_salida < date.today():
            raise ValueError("La fecha de salida no puede ser anterior a hoy")
        if self.fecha_regreso <= self.fecha_salida:
            raise ValueError("La fecha de regreso debe ser posterior a la salida")
        return self


class SolicitudSesion(BaseModel):
    correo: str
    contrasena: str

    @field_validator("correo", "contrasena")
    @classmethod
    def _obligatorio(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El campo es obligatorio")
        return stripped


def _bearer(authorization: str | None) -> str:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión no es válida")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión no es válida")
    return token


@router.get("/")
def info() -> dict:
    return {"component": "BFF Móvil"}


@router.post("/sesiones")
def iniciar_sesion(solicitud: SolicitudSesion) -> dict:
    return call_upstream(identidad.post, "/identidad/sesiones", json=solicitud.model_dump())


@router.post("/registros", status_code=status.HTTP_201_CREATED)
def registrar(solicitud: SolicitudSesion) -> dict:
    return call_upstream(identidad.post, "/identidad/clientes", json=solicitud.model_dump())


@router.get("/sesion")
def sesion_actual(authorization: Annotated[str | None, Header()] = None) -> dict:
    token = _bearer(authorization)
    try:
        payload = verify_token(token, settings.sesion_secreto)
    except InvalidToken as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión no es válida") from exc
    return {"cliente_id": payload.client_id}


@router.get("/productos")
def listar_productos() -> list:
    """Catálogo de productos del canal Mobile (vía servicio de Cotización)."""
    return call_upstream(cotizacion.get, "/catalogo/productos")


@router.post("/cotizaciones")
def cotizar(solicitud: SolicitudCotizacionMovil) -> dict:
    """Valida el formulario, delega en el consenso sin PII y devuelve la oferta completa."""
    return call_upstream(
        cotizacion.post,
        "/consenso/cotizaciones",
        json=solicitud.model_dump(mode="json", exclude={"nombre", "cedula"}),
        headers={"X-Canal": "mobile"},
    )


@router.post("/siniestros", status_code=201)
def reportar_siniestro(aviso: dict) -> dict:
    return call_upstream(siniestros.post, "/siniestros/avisos", json=aviso)


@router.post("/siniestros/{aviso_id}/evidencias/cargas", status_code=201)
def solicitar_carga(aviso_id: str, carga: dict) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json=carga,
    )


@router.post("/siniestros/{aviso_id}/evidencias/{evidencia_id}/confirmar")
def confirmar_carga(aviso_id: str, evidencia_id: str) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/evidencias/{evidencia_id}/confirmar",
    )


@router.get("/siniestros/{aviso_id}/evidencias")
def listar_evidencias(aviso_id: str):
    return call_upstream(siniestros.get, f"/siniestros/avisos/{aviso_id}/evidencias")
