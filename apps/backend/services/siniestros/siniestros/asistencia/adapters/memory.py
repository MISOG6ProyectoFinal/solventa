from siniestros.asistencia.domain.errors import MSG_DUPLICADA, ReglaAsistencia
from siniestros.asistencia.domain.models import Asistencia


class InMemoryAsistenciaRepository:
    def __init__(self) -> None:
        self.asistencias: dict[str, Asistencia] = {}

    def add(self, asistencia: Asistencia) -> None:
        if asistencia.aviso_id in self.asistencias:
            raise ReglaAsistencia(409, MSG_DUPLICADA)
        self.asistencias[asistencia.aviso_id] = asistencia

    def get_by_aviso(self, aviso_id: str) -> Asistencia | None:
        return self.asistencias.get(aviso_id)

    def get_by_numero(self, numero: str) -> Asistencia | None:
        return next((item for item in self.asistencias.values() if item.numero == numero), None)
