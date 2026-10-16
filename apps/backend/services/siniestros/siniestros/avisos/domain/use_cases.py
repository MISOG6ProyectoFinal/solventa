import random
import uuid
from collections.abc import Callable
from datetime import timedelta

from siniestros.avisos.domain.errors import ReglaEvidencia
from siniestros.avisos.domain.models import Aviso, Carga, Evidencia, EvidenciaLista
from siniestros.avisos.domain.ports import AvisoRepository, ObjectStore

MAX_BYTES = 52_428_800
MAX_EVIDENCIAS = 10
ALLOWED_TYPES = frozenset({"image/jpeg", "image/png", "video/mp4"})
URL_TTL = timedelta(minutes=15)

MSG_REPORTE = "No se encontró el reporte."
MSG_EVIDENCIA = "Agrega al menos una evidencia"
MSG_RADICADO = "No se pudo asignar un número de radicado."
MSG_TIPO = "Tipo de archivo no permitido. Use JPEG, PNG o MP4."
MSG_TAMANO = "El archivo supera 50 MB."
MSG_LIMITE = "Este reporte ya tiene 10 evidencias."
MSG_VALIDACION = "El archivo no pasó la validación."


def object_key(aviso_id: str, evidencia_id: str) -> str:
    return f"avisos/{aviso_id}/evidencias/{evidencia_id}"


def aviso_del_cliente(repository: AvisoRepository, aviso_id: str, cliente_id: str) -> Aviso:
    aviso = repository.get_aviso(aviso_id)
    if aviso is None or aviso.cliente_id != cliente_id:
        raise ReglaEvidencia(404, MSG_REPORTE)
    return aviso


def header_matches(content_type: str, header: bytes) -> bool:
    if content_type == "image/jpeg":
        return header.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return header.startswith(b"\x89PNG")
    if content_type == "video/mp4":
        return len(header) >= 8 and header[4:8] == b"ftyp"
    return False


class CrearAvisoUseCase:
    def __init__(self, repository: AvisoRepository) -> None:
        self.repository = repository

    def execute(
        self,
        poliza_id: str,
        tipo: str,
        ocurrido_en,
        descripcion: str,
        ubicacion: str | None = None,
        *,
        cliente_id: str,
    ) -> Aviso:
        aviso = Aviso(
            id=str(uuid.uuid4()),
            cliente_id=cliente_id,
            poliza_id=poliza_id,
            tipo=tipo,
            ocurrido_en=ocurrido_en,
            descripcion=descripcion,
            ubicacion=ubicacion,
            estado="borrador",
        )
        self.repository.add_aviso(aviso)
        return aviso


class ListarAvisosUseCase:
    def __init__(self, repository: AvisoRepository) -> None:
        self.repository = repository

    def execute(self, *, cliente_id: str) -> list[Aviso]:
        return self.repository.list_avisos(cliente_id)


def nuevo_radicado() -> str:
    return f"SIN-{random.randint(10000, 99999)}"


class RadicarAvisoUseCase:
    def __init__(self, repository: AvisoRepository, radicado_factory: Callable[[], str] = nuevo_radicado) -> None:
        self.repository = repository
        self.radicado_factory = radicado_factory

    def execute(self, aviso_id: str, *, cliente_id: str) -> Aviso:
        aviso = aviso_del_cliente(self.repository, aviso_id, cliente_id)
        if aviso.estado == "radicado":
            return aviso
        disponibles = [item for item in self.repository.list_evidencias(aviso_id) if item.estado == "disponible"]
        if not disponibles:
            raise ReglaEvidencia(422, MSG_EVIDENCIA)
        filed = aviso.model_copy(update={"estado": "radicado", "radicado": self._radicado_libre()})
        self.repository.update_aviso(filed)
        return filed

    def _radicado_libre(self) -> str:
        for _ in range(5):
            candidato = self.radicado_factory()
            if self.repository.get_by_radicado(candidato) is None:
                return candidato
        raise ReglaEvidencia(409, MSG_RADICADO)


class SolicitarCargaUseCase:
    def __init__(self, repository: AvisoRepository, store: ObjectStore, bucket: str) -> None:
        self.repository = repository
        self.store = store
        self.bucket = bucket

    def execute(self, aviso_id: str, content_type: str, size: int, *, cliente_id: str) -> Carga:
        aviso_del_cliente(self.repository, aviso_id, cliente_id)
        if content_type not in ALLOWED_TYPES:
            raise ReglaEvidencia(422, MSG_TIPO)
        if size < 1 or size > MAX_BYTES:
            raise ReglaEvidencia(422, MSG_TAMANO)
        if self.repository.count_activas(aviso_id) >= MAX_EVIDENCIAS:
            raise ReglaEvidencia(409, MSG_LIMITE)

        evidencia_id = str(uuid.uuid4())
        key = object_key(aviso_id, evidencia_id)
        upload_url, headers, expires_at = self.store.presign_put(key, content_type, size)
        self.repository.add_evidencia(
            Evidencia(
                id=evidencia_id,
                aviso_id=aviso_id,
                object_key=key,
                url=f"s3://{self.bucket}/{key}",
                content_type=content_type,
                tamano=size,
                estado="pendiente_carga",
            )
        )
        return Carga(
            evidencia_id=evidencia_id,
            upload_url=upload_url,
            headers=headers,
            expires_at=expires_at,
        )


class ConfirmarCargaUseCase:
    def __init__(self, repository: AvisoRepository, store: ObjectStore) -> None:
        self.repository = repository
        self.store = store

    def execute(self, aviso_id: str, evidencia_id: str, *, cliente_id: str) -> Evidencia:
        aviso_del_cliente(self.repository, aviso_id, cliente_id)
        evidencia = self.repository.get_evidencia(aviso_id, evidencia_id)
        if evidencia is None:
            raise ReglaEvidencia(404, MSG_REPORTE)

        stored = self.store.head(evidencia.object_key)
        if (
            stored is None
            or stored.size != evidencia.tamano
            or stored.size < 1
            or stored.size > MAX_BYTES
            or stored.content_type != evidencia.content_type
        ):
            self._rechazar(evidencia)

        header = self.store.read_header(evidencia.object_key)
        if not header_matches(evidencia.content_type, header):
            self._rechazar(evidencia)

        ready = evidencia.model_copy(update={"estado": "disponible"})
        self.repository.update_evidencia(ready)
        return ready

    def _rechazar(self, evidencia: Evidencia) -> None:
        self.repository.update_evidencia(evidencia.model_copy(update={"estado": "rechazada"}))
        raise ReglaEvidencia(422, MSG_VALIDACION)


class ListarEvidenciasUseCase:
    def __init__(self, repository: AvisoRepository, store: ObjectStore) -> None:
        self.repository = repository
        self.store = store

    def execute(self, aviso_id: str, *, cliente_id: str) -> list[EvidenciaLista]:
        aviso_del_cliente(self.repository, aviso_id, cliente_id)
        listed: list[EvidenciaLista] = []
        for evidencia in self.repository.list_evidencias(aviso_id):
            if evidencia.estado != "disponible":
                continue
            listed.append(
                EvidenciaLista(
                    id=evidencia.id,
                    url=evidencia.url,
                    content_type=evidencia.content_type,
                    tamano=evidencia.tamano,
                    estado=evidencia.estado,
                    download_url=self.store.presign_get(evidencia.object_key),
                )
            )
        return listed
