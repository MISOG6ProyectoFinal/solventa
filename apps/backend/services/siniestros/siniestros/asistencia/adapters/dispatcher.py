"""Despacho por la red de asistencia. RED_ASISTENCIA_URL apunta al servicio simuladores mientras no hay red real."""

from solventa_common.integration import RedAsistenciaAdapter

from siniestros.asistencia.domain.errors import MSG_RED, ReglaAsistencia
from siniestros.asistencia.domain.models import Despacho, NuevaAsistencia


class AssistanceNetworkDispatcher:
    def __init__(self, adapter: RedAsistenciaAdapter) -> None:
        self.adapter = adapter

    def dispatch(self, solicitud: NuevaAsistencia) -> Despacho:
        try:
            respuesta = self.adapter.dispatch(solicitud.servicio, solicitud.ubicacion, solicitud.gps)
            return Despacho.model_validate(respuesta)
        except Exception as exc:
            raise ReglaAsistencia(503, MSG_RED) from exc
