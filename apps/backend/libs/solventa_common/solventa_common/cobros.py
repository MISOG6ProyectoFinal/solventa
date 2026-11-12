"""Contrato del cobro que publica Pagos: sus estados y la moneda. Pagos es el dueño; los demás lo leen."""

from enum import StrEnum

MONEDA_COP = "COP"


class EstadoCobro(StrEnum):
    PROCESANDO = "procesando"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"
