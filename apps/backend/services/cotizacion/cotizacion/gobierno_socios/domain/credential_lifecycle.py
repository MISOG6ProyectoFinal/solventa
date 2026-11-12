"""Rotación y revocación de la credencial del socio, con su bitácora de eventos."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel, Field

from cotizacion.gobierno_socios.domain import credenciales
from cotizacion.gobierno_socios.domain.models import (
    CredentialEvent,
    CredentialEventType,
    EstadoCredencial,
    Socio,
    SocioCreadoResponse,
    SocioNoEncontrado,
    Texto,
)
from cotizacion.gobierno_socios.domain.ports import SocioRepository

MAX_GRACE_MINUTES = 10_080


class RotationRequest(BaseModel):
    actor: Texto
    gracia_minutos: int | None = Field(default=None, ge=0, le=MAX_GRACE_MINUTES)


class RevocationRequest(BaseModel):
    actor: Texto


class RotatedCredentialResponse(SocioCreadoResponse):
    gracia_hasta: datetime | None


def _utc_now() -> datetime:
    return datetime.now(UTC)


def accepts_secret(socio: Socio, secret: str, now: datetime) -> bool:
    if socio.estado_credencial != EstadoCredencial.ACTIVA:
        return False
    if credenciales.secreto_coincide(secret, socio.secreto_hash):
        return True
    return (
        socio.secreto_anterior_hash is not None
        and socio.secreto_anterior_vence is not None
        and now < socio.secreto_anterior_vence
        and credenciales.secreto_coincide(secret, socio.secreto_anterior_hash)
    )


class RotateCredentialUseCase:
    def __init__(
        self, socios: SocioRepository, default_grace: timedelta, now: Callable[[], datetime] = _utc_now
    ) -> None:
        self.socios = socios
        self.default_grace = default_grace
        self.now = now

    def execute(self, socio_id: str, actor: str, grace: timedelta | None = None) -> tuple[Socio, str]:
        socio = self.socios.get(socio_id)
        if socio is None:
            raise SocioNoEncontrado(socio_id)
        now = self.now()
        grace = self.default_grace if grace is None else grace
        keeps_previous = socio.estado_credencial == EstadoCredencial.ACTIVA and grace > timedelta(0)
        secret = credenciales.generar_secreto()
        rotated = socio.model_copy(
            update={
                "secreto_hash": credenciales.hash_secreto(secret),
                "secreto_enmascarado": credenciales.enmascarar(secret),
                "estado_credencial": EstadoCredencial.ACTIVA,
                "secreto_anterior_hash": socio.secreto_hash if keeps_previous else None,
                "secreto_anterior_vence": now + grace if keeps_previous else None,
            }
        )
        event = CredentialEvent(
            socio_id=socio.id,
            tipo=CredentialEventType.ROTATED,
            actor=actor,
            fecha=now,
            gracia_hasta=rotated.secreto_anterior_vence,
        )
        self.socios.update_credential(rotated, event)
        return rotated, secret


class RevokeCredentialUseCase:
    def __init__(self, socios: SocioRepository, now: Callable[[], datetime] = _utc_now) -> None:
        self.socios = socios
        self.now = now

    def execute(self, socio_id: str, actor: str) -> Socio:
        socio = self.socios.get(socio_id)
        if socio is None:
            raise SocioNoEncontrado(socio_id)
        revoked = socio.model_copy(
            update={
                "estado_credencial": EstadoCredencial.REVOCADA,
                "secreto_anterior_hash": None,
                "secreto_anterior_vence": None,
            }
        )
        event = CredentialEvent(socio_id=socio.id, tipo=CredentialEventType.REVOKED, actor=actor, fecha=self.now())
        self.socios.update_credential(revoked, event)
        return revoked


class CredentialEventsQuery:
    def __init__(self, socios: SocioRepository) -> None:
        self.socios = socios

    def execute(self, socio_id: str) -> list[CredentialEvent]:
        if self.socios.get(socio_id) is None:
            raise SocioNoEncontrado(socio_id)
        return sorted(self.socios.credential_events(socio_id), key=lambda event: event.fecha, reverse=True)
