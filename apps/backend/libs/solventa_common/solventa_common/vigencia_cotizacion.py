"""Vigencia para pagar una oferta de cotización.

No es la vigencia propuesta del seguro (las fechas de cobertura). Es hasta cuándo
se puede cobrar esa oferta: el final del día civil de Colombia en que se generó.

Colombia no observa horario de verano desde 1993, así que el reloj es UTC-5 fijo.
"""

from datetime import datetime, time, timedelta, timezone

ZONA_COTIZACION = timezone(timedelta(hours=-5))
FIN_DE_DIA = time(23, 59, 59)
VIGENTE_HASTA_DESCONOCIDO = datetime(1970, 1, 1, tzinfo=ZONA_COTIZACION)


def calcular_vigente_hasta(generada_en: datetime | None = None) -> datetime:
    """Fin del día, en hora de Colombia, en que se generó la oferta."""
    momento = generada_en or datetime.now(ZONA_COTIZACION)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=ZONA_COTIZACION)
    else:
        momento = momento.astimezone(ZONA_COTIZACION)
    return datetime.combine(momento.date(), FIN_DE_DIA, tzinfo=ZONA_COTIZACION)


def oferta_se_puede_cobrar(vigente_hasta: datetime | str | None, ahora: datetime | None = None) -> bool:
    """Verdadero solo si el instante cae dentro del límite ya calculado y persistido."""
    if not vigente_hasta:
        return False
    limite = vigente_hasta if isinstance(vigente_hasta, datetime) else datetime.fromisoformat(vigente_hasta)
    if limite.tzinfo is None:
        return False
    momento = ahora or datetime.now(ZONA_COTIZACION)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=ZONA_COTIZACION)
    return momento <= limite
