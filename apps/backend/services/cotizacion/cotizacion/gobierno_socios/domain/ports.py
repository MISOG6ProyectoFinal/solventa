from typing import Protocol

from cotizacion.gobierno_socios.domain.models import Socio


class SocioRepository(Protocol):
    def add(self, socio: Socio) -> None:
        """Guarda el socio completo o nada. Lanza IdentificadorDuplicado si ya existe."""
        ...

    def list_socios(self) -> list[Socio]: ...

    def get(self, socio_id: str) -> Socio | None: ...

    def get_by_client_id(self, client_id: str) -> Socio | None: ...
