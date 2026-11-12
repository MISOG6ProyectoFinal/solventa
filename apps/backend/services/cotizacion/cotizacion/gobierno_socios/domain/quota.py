"""Cuota de consumo por socio: solicitudes por minuto, contadas por ventana fija."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Protocol

from pydantic import BaseModel, Field

from cotizacion.gobierno_socios.domain.models import AuthorizedPartner, Socio, SocioNoEncontrado
from cotizacion.gobierno_socios.domain.ports import SocioRepository

QUOTA_WINDOW = timedelta(minutes=1)
QUOTA_WARNING_RATIO = 0.8
MAX_QUOTA = 1_000_000

logger = logging.getLogger(__name__)


class QuotaUsage(BaseModel):
    socio_id: str
    cuota_consumo: int
    consumidas: int
    ventana_inicio: datetime
    reinicia_en_s: int
    permitido: bool
    cerca_del_limite: bool


class PartnerAuthorization(AuthorizedPartner):
    consumo: QuotaUsage


class QuotaUpdateRequest(BaseModel):
    cuota_consumo: int = Field(ge=1, le=MAX_QUOTA)


class QuotaCounter(Protocol):
    def increment(self, socio_id: str, window_start: datetime) -> int: ...

    def count(self, socio_id: str, window_start: datetime) -> int: ...


def window_start(now: datetime) -> datetime:
    return now.replace(second=0, microsecond=0)


def _usage(socio: Socio, used: int, start: datetime, now: datetime, allowed: bool) -> QuotaUsage:
    return QuotaUsage(
        socio_id=socio.id,
        cuota_consumo=socio.cuota_consumo,
        consumidas=used,
        ventana_inicio=start,
        reinicia_en_s=max(1, int((start + QUOTA_WINDOW - now).total_seconds())),
        permitido=allowed,
        cerca_del_limite=used >= socio.cuota_consumo * QUOTA_WARNING_RATIO,
    )


def _utc_now() -> datetime:
    return datetime.now(UTC)


class ConsumeQuotaUseCase:
    def __init__(self, counter: QuotaCounter, now: Callable[[], datetime] = _utc_now) -> None:
        self.counter = counter
        self.now = now

    def execute(self, socio: Socio) -> QuotaUsage:
        now = self.now()
        start = window_start(now)
        used = self.counter.increment(socio.id, start)
        usage = _usage(socio, used, start, now, allowed=used <= socio.cuota_consumo)
        if usage.cerca_del_limite:
            logger.warning(
                "Socio cerca o por encima de su cuota",
                extra={"socio_id": socio.id, "consumidas": used, "cuota_consumo": socio.cuota_consumo},
            )
        return usage


class QuotaUsageQuery:
    def __init__(self, socios: SocioRepository, counter: QuotaCounter, now: Callable[[], datetime] = _utc_now) -> None:
        self.socios = socios
        self.counter = counter
        self.now = now

    def execute(self, socio_id: str) -> QuotaUsage:
        socio = self.socios.get(socio_id)
        if socio is None:
            raise SocioNoEncontrado(socio_id)
        now = self.now()
        start = window_start(now)
        used = self.counter.count(socio.id, start)
        return _usage(socio, used, start, now, allowed=used < socio.cuota_consumo)


class UpdateQuotaUseCase:
    def __init__(self, socios: SocioRepository) -> None:
        self.socios = socios

    def execute(self, socio_id: str, quota: int) -> Socio:
        socio = self.socios.update_quota(socio_id, quota)
        if socio is None:
            raise SocioNoEncontrado(socio_id)
        return socio
