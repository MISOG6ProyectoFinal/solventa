import uuid
from datetime import timedelta

from siniestros.avisos.domain.errors import ReglaEvidencia
from siniestros.avisos.domain.models import Aviso, Carga, Evidencia, EvidenciaLista
from siniestros.avisos.domain.ports import AvisoRepository, ObjectStore

MAX_BYTES = 52_428_800
MAX_EVIDENCIAS = 10
ALLOWED_TYPES = frozenset({"image/jpeg", "image/png", "video/mp4"})
URL_TTL = timedelta(minutes=15)

MSG_REPORTE = "No se encontró el reporte."
MSG_TIPO = "Tipo de archivo no permitido. Use JPEG, PNG o MP4."
MSG_TAMANO = "El archivo supera 50 MB."
MSG_LIMITE = "Este reporte ya tiene 10 evidencias."
MSG_VALIDACION = "El archivo no pasó la validación."


def object_key(aviso_id: str, evidencia_id: str) -> str:
    return f"avisos/{aviso_id}/evidencias/{evidencia_id}"


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
    ) -> Aviso:
        aviso = Aviso(
            id=str(uuid.uuid4()),
            poliza_id=poliza_id,
            tipo=tipo,
            ocurrido_en=ocurrido_en,
            descripcion=descripcion,
            ubicacion=ubicacion,
            estado="borrador",
        )
        self.repository.add_aviso(aviso)
        return aviso


class SolicitarCargaUseCase:
    def __init__(self, repository: AvisoRepository, store: ObjectStore, bucket: str) -> None:
        self.repository = repository
        self.store = store
        self.bucket = bucket

    def execute(self, aviso_id: str, content_type: str, size: int) -> Carga:
        if self.repository.get_aviso(aviso_id) is None:
            raise ReglaEvidencia(404, MSG_REPORTE)
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

    def execute(self, aviso_id: str, evidencia_id: str) -> Evidencia:
        if self.repository.get_aviso(aviso_id) is None:
            raise ReglaEvidencia(404, MSG_REPORTE)
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

    def execute(self, aviso_id: str) -> list[EvidenciaLista]:
        if self.repository.get_aviso(aviso_id) is None:
            raise ReglaEvidencia(404, MSG_REPORTE)
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
