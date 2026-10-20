"""Resuelve el score de riesgo sin romper el presupuesto del flujo (ASR-03, ASR-10)."""

import logging
import time
from collections.abc import Callable
from decimal import Decimal

from cotizacion.senales.domain.models import RIESGO_NEUTRAL, ConsentimientoOpenFinance, OrigenSenal, SenalAplicada
from cotizacion.senales.domain.ports import CacheSenales, ProveedorPerfil

logger = logging.getLogger(__name__)


class ResolverPerfilRiesgoUseCase:
    """Proveedor si responde a tiempo; si no, el último valor bueno; si no hay, el valor neutral."""

    def __init__(
        self,
        proveedor: ProveedorPerfil,
        cache: CacheSenales,
        vigencia_s: int,
        reloj: Callable[[], float] = time.perf_counter,
    ) -> None:
        self.proveedor = proveedor
        self.cache = cache
        self.vigencia_s = vigencia_s
        self.reloj = reloj

    def execute(self, consentimiento: ConsentimientoOpenFinance) -> SenalAplicada:
        clave = f"perfil:{self.proveedor.fuente}:{consentimiento.referencia_cliente}:{consentimiento.consentimiento_id}"
        inicio = self.reloj()
        try:
            score = self.proveedor.consultar_riesgo(consentimiento)
        except Exception as exc:
            logger.warning("Señal %s degradada: %s", self.proveedor.fuente, type(exc).__name__)
            score, origen = self._respaldo(clave)
        else:
            origen = OrigenSenal.PROVEEDOR
            self._guardar(clave, score)
        return SenalAplicada(
            fuente=self.proveedor.fuente,
            origen=origen,
            score_riesgo=score,
            latencia_ms=round((self.reloj() - inicio) * 1000),
        )

    def _respaldo(self, clave: str) -> tuple[Decimal, OrigenSenal]:
        try:
            guardado = self.cache.get(clave)
        except Exception:
            guardado = None
        if guardado is None:
            return RIESGO_NEUTRAL, OrigenSenal.VALOR_POR_DEFECTO
        return Decimal(str(guardado)), OrigenSenal.CACHE

    def _guardar(self, clave: str, score: Decimal) -> None:
        try:
            self.cache.set(clave, str(score), self.vigencia_s)
        except Exception:
            logger.warning("No se pudo guardar el último valor bueno de %s", self.proveedor.fuente)
