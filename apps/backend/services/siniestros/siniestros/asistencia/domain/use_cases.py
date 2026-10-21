import uuid
from datetime import UTC, datetime

from solventa_common.events import Event, EventPublisher

from siniestros.asistencia.domain.errors import (
    MSG_AVISO,
    MSG_BORRADOR,
    MSG_DUPLICADA,
    MSG_NUMERO,
    ReglaAsistencia,
)
from siniestros.asistencia.domain.models import Asistencia, Despacho, NuevaAsistencia
from siniestros.asistencia.domain.ports import AsistenciaRepository, AssistanceDispatcher
from siniestros.avisos.domain.models import Aviso
from siniestros.avisos.domain.ports import AvisoRepository

EVENT_TYPE = "AssistanceDispatchedEvent"
INTENTOS_NUMERO = 5


def aviso_del_cliente(avisos: AvisoRepository, aviso_id: str, cliente_id: str) -> Aviso:
    aviso = avisos.get_aviso(aviso_id)
    if aviso is None or aviso.cliente_id != cliente_id:
        raise ReglaAsistencia(404, MSG_AVISO)
    return aviso


class SolicitarAsistenciaUseCase:
    def __init__(
        self,
        avisos: AvisoRepository,
        repository: AsistenciaRepository,
        dispatcher: AssistanceDispatcher,
        publisher: EventPublisher,
    ) -> None:
        self.avisos = avisos
        self.repository = repository
        self.dispatcher = dispatcher
        self.publisher = publisher

    def execute(self, aviso_id: str, solicitud: NuevaAsistencia, *, cliente_id: str) -> Asistencia:
        aviso = aviso_del_cliente(self.avisos, aviso_id, cliente_id)
        if aviso.estado != "radicado":
            raise ReglaAsistencia(409, MSG_BORRADOR)
        if self.repository.get_by_aviso(aviso_id) is not None:
            raise ReglaAsistencia(409, MSG_DUPLICADA)

        despacho = self._despacho_libre(solicitud)
        asistencia = Asistencia(
            id=str(uuid.uuid4()),
            aviso_id=aviso_id,
            cliente_id=cliente_id,
            servicio=solicitud.servicio,
            ubicacion=solicitud.ubicacion,
            gps=solicitud.gps,
            numero=despacho.numero,
            eta_min=despacho.eta_min,
            eta_max=despacho.eta_max,
            solicitada_en=datetime.now(UTC),
        )
        self.repository.add(asistencia)
        # The key is per aviso, so a consumer can discard a repeat if a retry publishes twice.
        self.publisher.publish(
            Event(
                event_type=EVENT_TYPE,
                source="siniestros",
                idempotency_key=f"asistencia:{aviso_id}",
                payload={
                    "asistencia_id": asistencia.id,
                    "numero": asistencia.numero,
                    "aviso_id": aviso_id,
                    "poliza_id": aviso.poliza_id,
                    "cliente_id": cliente_id,
                    "servicio": asistencia.servicio,
                    "ubicacion": asistencia.ubicacion,
                    "gps": asistencia.gps,
                },
            )
        )
        return asistencia

    def _despacho_libre(self, solicitud: NuevaAsistencia) -> Despacho:
        for _ in range(INTENTOS_NUMERO):
            despacho = self.dispatcher.dispatch(solicitud)
            if self.repository.get_by_numero(despacho.numero) is None:
                return despacho
        raise ReglaAsistencia(409, MSG_NUMERO)


class ListarAsistenciasUseCase:
    def __init__(self, avisos: AvisoRepository, repository: AsistenciaRepository) -> None:
        self.avisos = avisos
        self.repository = repository

    def execute(self, aviso_id: str, *, cliente_id: str) -> list[Asistencia]:
        aviso_del_cliente(self.avisos, aviso_id, cliente_id)
        asistencia = self.repository.get_by_aviso(aviso_id)
        return [asistencia] if asistencia else []
