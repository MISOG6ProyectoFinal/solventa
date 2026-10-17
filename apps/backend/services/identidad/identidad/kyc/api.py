from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator

from identidad.container import container
from identidad.kyc.domain.models import EmailAlreadyRegistered, InvalidCredentials

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

    @field_validator("nombre", "apellido")
    @classmethod
    def _nombre_obligatorio(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El campo es obligatorio")
        return stripped


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
        )
    except EmailAlreadyRegistered as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con este correo.") from exc
    return {"token": session.token, "cliente_id": session.client_id}
