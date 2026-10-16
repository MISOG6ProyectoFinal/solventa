from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator
from solventa_common.integration.base import call_upstream
from solventa_common.sesion import InvalidToken, SessionToken, verify_token

from canales.clients import cotizacion, identidad, siniestros
from canales.config import settings

router = APIRouter(prefix="/movil", tags=["BFF Móvil"])

INVALID_SESSION = "La sesión no es válida"


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


class SolicitudRegistro(SolicitudSesion):
    nombre: str
    apellido: str

    @field_validator("nombre", "apellido")
    @classmethod
    def _nombre_obligatorio(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El campo es obligatorio")
        return stripped


def _bearer(authorization: str | None) -> str:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)
    return token


def require_session(authorization: Annotated[str | None, Header()] = None) -> SessionToken:
    try:
        return verify_token(_bearer(authorization), settings.sesion_secreto)
    except InvalidToken as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION) from exc


authenticated = APIRouter(dependencies=[Depends(require_session)])
Session = Annotated[SessionToken, Depends(require_session)]


def _cliente(session: SessionToken) -> dict[str, str]:
    return {"X-Cliente-Id": session.client_id}


@router.get("/")
def info() -> dict:
    return {"component": "BFF Móvil"}


@router.post("/sesiones")
def iniciar_sesion(solicitud: SolicitudSesion) -> dict:
    return call_upstream(identidad.post, "/identidad/sesiones", json=solicitud.model_dump())


@router.post("/registros", status_code=status.HTTP_201_CREATED)
def registrar(solicitud: SolicitudRegistro) -> dict:
    return call_upstream(identidad.post, "/identidad/clientes", json=solicitud.model_dump())


@authenticated.get("/sesion")
def sesion_actual(payload: Session) -> dict:
    return {
        "cliente_id": payload.client_id,
        "correo": payload.email,
        "nombre": payload.first_name,
        "apellido": payload.last_name,
    }


@authenticated.get("/productos")
def listar_productos() -> list:
    """Catálogo de productos del canal Mobile (vía servicio de Cotización)."""
    return call_upstream(cotizacion.get, "/catalogo/productos")


@authenticated.post("/cotizaciones")
def cotizar(solicitud: SolicitudCotizacionMovil) -> dict:
    """Valida el formulario, delega en el consenso sin PII y devuelve la oferta completa."""
    return call_upstream(
        cotizacion.post,
        "/consenso/cotizaciones",
        json=solicitud.model_dump(mode="json", exclude={"nombre", "cedula"}),
        headers={"X-Canal": "mobile"},
    )


@authenticated.post("/siniestros", status_code=201)
def reportar_siniestro(aviso: dict, session: Session) -> dict:
    return call_upstream(
        siniestros.post,
        "/siniestros/avisos",
        json={**aviso, "cliente_id": session.client_id},
    )


@authenticated.post("/siniestros/{aviso_id}/evidencias/cargas", status_code=201)
def solicitar_carga(aviso_id: str, carga: dict, session: Session) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json=carga,
        headers=_cliente(session),
    )


@authenticated.post("/siniestros/{aviso_id}/evidencias/{evidencia_id}/confirmar")
def confirmar_carga(aviso_id: str, evidencia_id: str, session: Session) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/evidencias/{evidencia_id}/confirmar",
        headers=_cliente(session),
    )


@authenticated.get("/siniestros/{aviso_id}/evidencias")
def listar_evidencias(aviso_id: str, session: Session):
    return call_upstream(
        siniestros.get,
        f"/siniestros/avisos/{aviso_id}/evidencias",
        headers=_cliente(session),
    )


router.include_router(authenticated)
