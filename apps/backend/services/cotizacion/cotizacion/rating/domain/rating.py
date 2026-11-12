"""Reglas de rating como configuración versionada y cálculo de prima."""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field

from cotizacion.rating.domain.models import (
    MIN_INSURED_AGE,
    DesgloseCotizacion,
    SolicitudCotizacionMicroseguroVida,
    SolicitudCotizacionParametrico,
    SolicitudCotizacionViaje,
    SolicitudCotizacionVidaHipotecario,
)
from cotizacion.signals.domain.models import NEUTRAL_RISK_SCORE


class ReglasRating(BaseModel):
    version: str
    tasa_iva: Decimal
    tasa_base_por_mil: dict[str, Decimal]
    factor_edad: list[tuple[int, Decimal]]
    peso_score: Decimal
    tarifa_viaje_por_dia: dict[str, Decimal] = Field(default_factory=dict)
    recargo_viaje_por_destino: dict[str, Decimal] = Field(default_factory=dict)
    coberturas_adicionales_viaje_por_destino: dict[str, Decimal] = Field(default_factory=dict)
    tarifa_parametrico: dict[str, Decimal] = Field(default_factory=dict)
    tarifa_parametrico_por_defecto: Decimal
    recargo_factor_parametrico: Decimal
    coberturas_adicionales_factor_parametrico: Decimal
    tasa_vida_hipotecario_por_mil: Decimal
    coberturas_adicionales_factor_hipotecario: Decimal
    tasa_microseguro_por_mil: Decimal
    recargo_factor_microseguro: Decimal
    coberturas_adicionales_factor_microseguro: Decimal


def _iva(reglas: ReglasRating, base: Decimal) -> Decimal:
    return (base * reglas.tasa_iva).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ProductoNoTarifado(LookupError):
    pass


class NoRulesPublished(LookupError):
    pass


class RulesVersionAlreadyPublished(ValueError):
    pass


def risk_factor(reglas: ReglasRating, score: Decimal) -> Decimal:
    """El score neutral deja el factor en 1."""
    return Decimal(1) + (score - NEUTRAL_RISK_SCORE) * reglas.peso_score


def insured_age(birth: date, reference: date) -> int:
    """Edad cumplida, nunca por debajo de la mínima que se asegura."""
    years = reference.year - birth.year - ((reference.month, reference.day) < (birth.month, birth.day))
    return max(MIN_INSURED_AGE, years)


def calcular_desglose_generico(
    reglas: ReglasRating, producto_id: str, suma: Decimal, edad: int, score: Decimal
) -> DesgloseCotizacion:
    try:
        tasa = reglas.tasa_base_por_mil[producto_id]
    except KeyError as exc:
        raise ProductoNoTarifado(producto_id) from exc
    factor_edad = next(f for limite, f in reglas.factor_edad if edad <= limite)
    prima_basica = (suma / Decimal(1000) * tasa * factor_edad).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    factor_score = risk_factor(reglas, score)
    subtotal = (prima_basica * factor_score).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    recargo_riesgo = max(Decimal("0.00"), subtotal - prima_basica)
    impuestos = _iva(reglas, subtotal)
    return DesgloseCotizacion(
        prima_basica=prima_basica,
        recargo_riesgo=recargo_riesgo,
        coberturas_adicionales=Decimal("0.00"),
        impuestos=impuestos,
        total=subtotal + impuestos,
    )


def calcular_prima(reglas: ReglasRating, producto_id: str, suma: Decimal, edad: int, score: Decimal) -> Decimal:
    return calcular_desglose_generico(reglas, producto_id, suma, edad, score).total


def calcular_desglose_viaje(reglas: ReglasRating, solicitud: SolicitudCotizacionViaje) -> DesgloseCotizacion:
    """Tarifa diaria × días de viaje × viajeros × recargos e impuestos."""
    dias = (solicitud.fecha_regreso - solicitud.fecha_salida).days
    try:
        tarifa_dia = reglas.tarifa_viaje_por_dia[solicitud.producto_id]
    except KeyError as exc:
        raise ProductoNoTarifado(solicitud.producto_id) from exc

    prima_basica = (tarifa_dia * Decimal(dias) * Decimal(solicitud.viajeros)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    recargo_riesgo = (prima_basica * reglas.recargo_viaje_por_destino.get(solicitud.destino, Decimal(0))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    coberturas_adicionales = (
        prima_basica * reglas.coberturas_adicionales_viaje_por_destino.get(solicitud.destino, Decimal(0))
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    subtotal = prima_basica + recargo_riesgo + coberturas_adicionales
    impuestos = _iva(reglas, subtotal)
    return DesgloseCotizacion(
        prima_basica=prima_basica,
        recargo_riesgo=recargo_riesgo,
        coberturas_adicionales=coberturas_adicionales,
        impuestos=impuestos,
        total=subtotal + impuestos,
    )


def calcular_prima_viaje(reglas: ReglasRating, solicitud: SolicitudCotizacionViaje) -> Decimal:
    return calcular_desglose_viaje(reglas, solicitud).total


def calcular_desglose_microseguro_vida(
    reglas: ReglasRating, solicitud: SolicitudCotizacionMicroseguroVida, fecha_referencia: date | None = None
) -> DesgloseCotizacion:
    """Suma asegurada / 1000 × tasa base × factor edad con desglose completo de 5 rubros."""
    ref = fecha_referencia or date.today()
    edad = insured_age(solicitud.fecha_nacimiento, ref)
    factor_edad = next(f for limite, f in reglas.factor_edad if edad <= limite)
    monto_base = (solicitud.suma_asegurada / Decimal(1000)) * reglas.tasa_microseguro_por_mil * factor_edad
    prima_basica = monto_base.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    recargo_riesgo = (prima_basica * reglas.recargo_factor_microseguro).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    coberturas_adicionales = (prima_basica * reglas.coberturas_adicionales_factor_microseguro).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    subtotal = prima_basica + recargo_riesgo + coberturas_adicionales
    impuestos = _iva(reglas, subtotal)
    total = subtotal + impuestos
    return DesgloseCotizacion(
        prima_basica=prima_basica,
        recargo_riesgo=recargo_riesgo,
        coberturas_adicionales=coberturas_adicionales,
        impuestos=impuestos,
        total=total,
    )


def calcular_prima_microseguro_vida(
    reglas: ReglasRating, solicitud: SolicitudCotizacionMicroseguroVida, fecha_referencia: date | None = None
) -> Decimal:
    return calcular_desglose_microseguro_vida(reglas, solicitud, fecha_referencia).total


def calcular_desglose_vida_hipotecario(
    reglas: ReglasRating, solicitud: SolicitudCotizacionVidaHipotecario, fecha_referencia: date | None = None
) -> DesgloseCotizacion:
    """Valor crédito / 1000 × tasa anual × factor edad × plazo en años con desglose completo de 5 rubros."""
    ref = fecha_referencia or date.today()
    edad = insured_age(solicitud.fecha_nacimiento, ref)
    factor_edad = next(f for limite, f in reglas.factor_edad if edad <= limite)
    prima_basica = (
        (solicitud.valor_credito / Decimal(1000))
        * reglas.tasa_vida_hipotecario_por_mil
        * factor_edad
        * Decimal(solicitud.plazo_anios)
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    factor_score = risk_factor(reglas, solicitud.score_riesgo)
    recargo_riesgo = max(
        Decimal("0.00"), (prima_basica * (factor_score - 1)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    )
    coberturas_adicionales = (prima_basica * reglas.coberturas_adicionales_factor_hipotecario).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    subtotal = prima_basica + recargo_riesgo + coberturas_adicionales
    impuestos = _iva(reglas, subtotal)
    total = subtotal + impuestos
    return DesgloseCotizacion(
        prima_basica=prima_basica,
        recargo_riesgo=recargo_riesgo,
        coberturas_adicionales=coberturas_adicionales,
        impuestos=impuestos,
        total=total,
    )


def calcular_prima_vida_hipotecario(
    reglas: ReglasRating, solicitud: SolicitudCotizacionVidaHipotecario, fecha_referencia: date | None = None
) -> Decimal:
    return calcular_desglose_vida_hipotecario(reglas, solicitud, fecha_referencia).total


def calcular_desglose_parametrico(
    reglas: ReglasRating, solicitud: SolicitudCotizacionParametrico
) -> DesgloseCotizacion:
    """Tarifa según evento asegurado con desglose completo de 5 rubros."""
    tarifa = reglas.tarifa_parametrico.get(solicitud.evento, reglas.tarifa_parametrico_por_defecto).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    prima_basica = tarifa
    recargo_riesgo = (prima_basica * reglas.recargo_factor_parametrico).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    coberturas_adicionales = (prima_basica * reglas.coberturas_adicionales_factor_parametrico).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    subtotal = prima_basica + recargo_riesgo + coberturas_adicionales
    impuestos = _iva(reglas, subtotal)
    total = subtotal + impuestos
    return DesgloseCotizacion(
        prima_basica=prima_basica,
        recargo_riesgo=recargo_riesgo,
        coberturas_adicionales=coberturas_adicionales,
        impuestos=impuestos,
        total=total,
    )


def calcular_prima_parametrico(reglas: ReglasRating, solicitud: SolicitudCotizacionParametrico) -> Decimal:
    return calcular_desglose_parametrico(reglas, solicitud).total
