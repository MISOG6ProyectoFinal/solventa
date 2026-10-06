from datetime import UTC, datetime

from siniestros.avisos.domain.models import Aviso, Evidencia, ObjetoGuardado
from siniestros.avisos.domain.use_cases import URL_TTL


class InMemoryAvisoRepository:
    def __init__(self) -> None:
        self.avisos: dict[str, Aviso] = {}
        self.evidencias: dict[str, Evidencia] = {}

    def add_aviso(self, aviso: Aviso) -> None:
        self.avisos[aviso.id] = aviso

    def get_aviso(self, aviso_id: str) -> Aviso | None:
        return self.avisos.get(aviso_id)

    def add_evidencia(self, evidencia: Evidencia) -> None:
        self.evidencias[evidencia.id] = evidencia

    def update_evidencia(self, evidencia: Evidencia) -> None:
        self.evidencias[evidencia.id] = evidencia

    def get_evidencia(self, aviso_id: str, evidencia_id: str) -> Evidencia | None:
        evidencia = self.evidencias.get(evidencia_id)
        if evidencia is None or evidencia.aviso_id != aviso_id:
            return None
        return evidencia

    def list_evidencias(self, aviso_id: str) -> list[Evidencia]:
        return [item for item in self.evidencias.values() if item.aviso_id == aviso_id]

    def count_activas(self, aviso_id: str) -> int:
        return sum(1 for item in self.evidencias.values() if item.aviso_id == aviso_id and item.estado != "rechazada")


class InMemoryObjectStore:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[str, bytes]] = {}

    def guardar(self, key: str, content_type: str, body: bytes) -> None:
        self.objects[key] = (content_type, body)

    def presign_put(self, key: str, content_type: str, size: int) -> tuple[str, dict[str, str], datetime]:
        headers = {"Content-Type": content_type, "Content-Length": str(size)}
        return f"https://upload.local/{key}", headers, datetime.now(UTC) + URL_TTL

    def head(self, key: str) -> ObjetoGuardado | None:
        stored = self.objects.get(key)
        if stored is None:
            return None
        content_type, body = stored
        return ObjetoGuardado(content_type=content_type, size=len(body))

    def read_header(self, key: str) -> bytes:
        return self.objects[key][1][:32]

    def presign_get(self, key: str) -> str:
        return f"https://download.local/{key}"
