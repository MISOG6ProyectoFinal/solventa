"""Estado de cada servicio sondeado por el Monitor de Salud y Retiro."""

from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass
class EstadoServicio:
    servicio: str
    sano: bool = True
    fallas_consecutivas: int = 0
    latencia_ms: float | None = None
    ultimo_latido: datetime | None = field(default=None)

    def registrar(self, ok: bool, latencia_ms: float | None, fallas_para_retiro: int) -> None:
        self.ultimo_latido = datetime.now(UTC)
        self.latencia_ms = latencia_ms
        self.fallas_consecutivas = 0 if ok else self.fallas_consecutivas + 1
        self.sano = self.fallas_consecutivas < fallas_para_retiro
