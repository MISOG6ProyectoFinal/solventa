from typing import Protocol

from siniestros.asistencia.domain.models import Asistencia, Despacho, NuevaAsistencia


class AsistenciaRepository(Protocol):
    def add(self, asistencia: Asistencia) -> None: ...

    def get_by_aviso(self, aviso_id: str) -> Asistencia | None: ...

    def get_by_numero(self, numero: str) -> Asistencia | None: ...


class AssistanceDispatcher(Protocol):
    def dispatch(self, solicitud: NuevaAsistencia) -> Despacho: ...
