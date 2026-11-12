from typing import Protocol

from cotizacion.gobierno_socios.domain.configuracion import ConfiguracionSocio
from cotizacion.gobierno_socios.domain.models import CredentialEvent, Socio


class SocioRepository(Protocol):
    def add(self, socio: Socio) -> None:
        """Guarda el socio completo o nada. Lanza IdentificadorDuplicado si ya existe."""
        ...

    def list_socios(self) -> list[Socio]: ...

    def get(self, socio_id: str) -> Socio | None: ...

    def get_by_client_id(self, client_id: str) -> Socio | None: ...

    def update_quota(self, socio_id: str, quota: int) -> Socio | None: ...

    def update_credential(self, socio: Socio, event: CredentialEvent) -> None:
        """Guarda la credencial del socio y su evento en una sola transacción."""
        ...

    def credential_events(self, socio_id: str) -> list[CredentialEvent]: ...


class ConfiguracionRepository(Protocol):
    def get(self, socio_id: str) -> ConfiguracionSocio | None: ...

    def save(self, configuracion: ConfiguracionSocio) -> None:
        """Reemplaza la configuración completa del socio en una sola transacción."""
        ...

    def ramos_por_socio(self) -> dict[str, list[str]]: ...
