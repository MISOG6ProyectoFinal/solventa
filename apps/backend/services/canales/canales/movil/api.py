from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from solventa_common.integration.base import call_upstream
from solventa_common.sesion import InvalidToken, SessionToken, verify_token
from solventa_common.vigencia_cotizacion import oferta_se_puede_cobrar

from canales.clients import cotizacion, identidad, pagos, siniestros
from canales.config import settings
from canales.movil.simulacion_pago import forzar_cotizacion_vencida, token_prototipo

INVALID_SESSION = "La sesión no es válida"
MENSAJE_COTIZACION_VENCIDA = "Esta cotización ya no está vigente. No se realizó ningún cobro; vuelve a cotizar."

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


class SolicitudPagoMovil(BaseModel):
    """El monto no forma parte del contrato: se lee de la cotización persistida."""

    model_config = ConfigDict(extra="ignore")
    intento_id: str
    simulacion: Literal["rechazado", "vencida"] | None = None

    @field_validator("intento_id")
    @classmethod
    def _intento(cls, value: str) -> str:
        token = value.strip()
        if not token or len(token) > 64:
            raise ValueError("El intento de pago no es válido")
        return token


def _cotizacion_vencida() -> HTTPException:
    return HTTPException(
        status.HTTP_409_CONFLICT,
        {"codigo": "cotizacion_vencida", "mensaje": MENSAJE_COTIZACION_VENCIDA},
    )


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


@authenticated.post("/cotizaciones/{cotizacion_id}/pagos")
def pagar_cotizacion(cotizacion_id: str, session: Session, solicitud: SolicitudPagoMovil) -> dict:
    """Cobra la prima vigente. El valor sale de Cotización; la clave identifica el intento."""
    oferta = call_upstream(cotizacion.get, f"/consenso/cotizaciones/{cotizacion_id}")
    if not isinstance(oferta, dict) or oferta.get("prima") is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "La cotización no tiene un valor a cobrar")
    if oferta.get("cliente_id") != session.client_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cotización no encontrada")
    # vigente_hasta persistido es la regla. El flag solo demuestra el mismo rechazo en el prototipo.
    if not oferta_se_puede_cobrar(oferta.get("vigente_hasta")):
        raise _cotizacion_vencida()
    if forzar_cotizacion_vencida(solicitud.simulacion):
        raise _cotizacion_vencida()
    resultado = call_upstream(
        pagos.post,
        "/pagos/cobros",
        json={
            "cotizacion_id": cotizacion_id,
            "cliente_id": session.client_id,
            "monto": str(oferta["prima"]),
            "moneda": "COP",
            "idempotency_key": f"movil:{cotizacion_id}:{solicitud.intento_id}",
            "medio_token": token_prototipo(solicitud.simulacion),
        },
    )
    return {
        "id": resultado["id"],
        "cotizacion_id": resultado["cotizacion_id"],
        "estado": resultado["estado"],
        "monto": resultado["monto"],
        "moneda": resultado["moneda"],
    }


@authenticated.post("/cotizaciones")
def cotizar(solicitud: SolicitudCotizacionMovil, session: Session) -> dict:
    """Valida el formulario, delega en el consenso sin PII y devuelve la oferta completa."""
    oferta = call_upstream(
        cotizacion.post,
        "/consenso/cotizaciones",
        json=solicitud.model_dump(mode="json", exclude={"nombre", "cedula"}),
        headers={"X-Canal": "mobile", "X-Cliente-Id": session.client_id},
    )
    if isinstance(oferta, dict):
        oferta.pop("cliente_id", None)
    return oferta


@authenticated.get("/siniestros")
def listar_siniestros(session: Session) -> list:
    return call_upstream(siniestros.get, "/siniestros/avisos", headers=_cliente(session))


@authenticated.post("/siniestros", status_code=201)
def reportar_siniestro(aviso: dict, session: Session) -> dict:
    return call_upstream(
        siniestros.post,
        "/siniestros/avisos",
        json={**aviso, "cliente_id": session.client_id},
    )


@authenticated.post("/siniestros/{aviso_id}/radicar")
def radicar_siniestro(aviso_id: str, session: Session) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/radicar",
        headers=_cliente(session),
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


@authenticated.post("/siniestros/{aviso_id}/asistencias", status_code=201)
def solicitar_asistencia(aviso_id: str, solicitud: dict, session: Session) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/asistencias",
        json=solicitud,
        headers=_cliente(session),
    )


@authenticated.get("/siniestros/{aviso_id}/asistencias")
def listar_asistencias(aviso_id: str, session: Session):
    return call_upstream(
        siniestros.get,
        f"/siniestros/avisos/{aviso_id}/asistencias",
        headers=_cliente(session),
    )


@authenticated.get("/prestadores/cercanos")
def prestadores_cercanos(request: Request, session: Session):
    # The catalog is not per client, and Siniestros validates the query.
    return call_upstream(
        siniestros.get,
        "/siniestros/prestadores/cercanos",
        params=dict(request.query_params),
    )


router.include_router(authenticated)
