from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from cotizacion.gobierno_socios.domain import credenciales
from cotizacion.gobierno_socios.domain.models import (
    Alcance,
    AlcanceNoAutorizado,
    AltaSocio,
    ContratoSuspendido,
    CredencialInvalida,
    EstadoContrato,
    EstadoCredencial,
    Socio,
    SocioNoEncontrado,
)
from cotizacion.gobierno_socios.domain.ports import SocioRepository


def _ahora() -> datetime:
    return datetime.now(UTC)


class DarDeAltaSocioUseCase:
    """Registra el socio con su contrato activo y sus credenciales en una sola escritura."""

    def __init__(self, socios: SocioRepository, ahora: Callable[[], datetime] = _ahora) -> None:
        self.socios = socios
        self.ahora = ahora

    def execute(self, alta: AltaSocio, usuario: str) -> tuple[Socio, str]:
        secreto = credenciales.generar_secreto()
        socio = Socio(
            id=str(uuid4()),
            **alta.model_dump(),
            client_id=credenciales.generar_client_id(alta.identificador),
            secreto_hash=credenciales.hash_secreto(secreto),
            secreto_enmascarado=credenciales.enmascarar(secreto),
            alta_fecha=self.ahora(),
            alta_usuario=usuario,
        )
        self.socios.add(socio)
        return socio, secreto


class ConsultarSociosUseCase:
    def __init__(self, socios: SocioRepository) -> None:
        self.socios = socios

    def listar(self) -> list[Socio]:
        return sorted(self.socios.list_socios(), key=lambda s: s.alta_fecha, reverse=True)

    def obtener(self, socio_id: str) -> Socio:
        socio = self.socios.get(socio_id)
        if socio is None:
            raise SocioNoEncontrado(socio_id)
        return socio


class AutorizarSocioUseCase:
    """Reconoce las credenciales de una llamada del socio y verifica su alcance."""

    def __init__(self, socios: SocioRepository) -> None:
        self.socios = socios

    def execute(self, client_id: str, secreto: str, alcance: Alcance) -> Socio:
        socio = self.socios.get_by_client_id(client_id)
        if (
            socio is None
            or socio.estado_credencial != EstadoCredencial.ACTIVA
            or not credenciales.secreto_coincide(secreto, socio.secreto_hash)
        ):
            raise CredencialInvalida(client_id)
        if socio.estado_contrato != EstadoContrato.ACTIVO:
            raise ContratoSuspendido(socio.identificador)
        if alcance not in socio.alcances:
            raise AlcanceNoAutorizado(alcance)
        return socio
