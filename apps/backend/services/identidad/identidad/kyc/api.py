from datetime import date

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator

from identidad.container import container
from identidad.kyc.domain.models import (
    TIPOS_DOCUMENTO,
    CodigoOtpInvalido,
    ConsentimientoExpirado,
    ConsentimientoNoEncontrado,
    DocumentAlreadyRegistered,
    EmailAlreadyRegistered,
    InvalidCredentials,
    RespuestaConsulta,
    RespuestaSolicitud,
    RespuestaValidacion,
    SolicitudConsentimiento,
)

router = APIRouter(prefix="/identidad", tags=["Identidad, Consentimiento y KYC"])


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

    @field_validator("correo")
    @classmethod
    def _correo(cls, value: str) -> str:
        return value.lower()


class SolicitudRegistro(SolicitudSesion):
    nombre: str
    apellido: str
    tipo_documento: str
    numero_documento: str
    telefono: str
    fecha_nacimiento: date

    @field_validator("nombre", "apellido", "tipo_documento", "numero_documento", "telefono")
    @classmethod
    def _dato_obligatorio(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El campo es obligatorio")
        return stripped

    @field_validator("tipo_documento")
    @classmethod
    def _tipo_documento(cls, value: str) -> str:
        if value not in TIPOS_DOCUMENTO:
            raise ValueError("Tipo de documento no válido")
        return value

    @field_validator("fecha_nacimiento")
    @classmethod
    def _fecha_nacimiento(cls, value: date) -> date:
        if value >= date.today():
            raise ValueError("La fecha de nacimiento debe ser anterior a hoy")
        return value


class SolicitudValidacionOTP(BaseModel):
    consentimiento_id: str
    codigo: str


@router.get("/")
def info() -> dict:
    return {"component": "Identidad, Consentimiento y KYC"}


@router.post("/sesiones")
def iniciar_sesion(solicitud: SolicitudSesion) -> dict:
    try:
        session = container.start_session.execute(solicitud.correo, solicitud.contrasena)
    except InvalidCredentials as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos") from exc
    return {"token": session.token, "cliente_id": session.client_id}


@router.post("/clientes", status_code=status.HTTP_201_CREATED)
def registrar_cliente(solicitud: SolicitudRegistro) -> dict:
    try:
        session = container.register_client.execute(
            solicitud.correo,
            solicitud.contrasena,
            solicitud.nombre,
            solicitud.apellido,
            tipo_documento=solicitud.tipo_documento,
            numero_documento=solicitud.numero_documento,
            telefono=solicitud.telefono,
            fecha_nacimiento=solicitud.fecha_nacimiento,
        )
    except EmailAlreadyRegistered as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con este correo.") from exc
    except DocumentAlreadyRegistered as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con este documento.") from exc
    return {"token": session.token, "cliente_id": session.client_id}


# --- Endpoints de Consentimiento Digital (HU002) ---


@router.post("/solicitar", status_code=status.HTTP_201_CREATED, response_model=RespuestaSolicitud)
def solicitar_consentimiento(solicitud: SolicitudConsentimiento) -> RespuestaSolicitud:
    return container.solicitar_consentimiento.execute(solicitud)


@router.post("/validar", response_model=RespuestaValidacion)
def validar_consentimiento(solicitud: SolicitudValidacionOTP) -> RespuestaValidacion:
    try:
        return container.validar_consentimiento.execute(
            consentimiento_id=solicitud.consentimiento_id,
            codigo=solicitud.codigo,
        )
    except ConsentimientoNoEncontrado as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ConsentimientoExpirado as exc:
        raise HTTPException(status.HTTP_410_GONE, str(exc)) from exc
    except CodigoOtpInvalido as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.get("/{consentimiento_id}", response_model=RespuestaConsulta)
def consultar_consentimiento(consentimiento_id: str) -> RespuestaConsulta:
    try:
        return container.consultar_consentimiento.execute(consentimiento_id)
    except ConsentimientoNoEncontrado as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
