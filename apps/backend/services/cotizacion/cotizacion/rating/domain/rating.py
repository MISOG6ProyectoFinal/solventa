"""Reglas de rating como configuración versionada.

Actuaría cambia la tabla de tasas y factores publicando una nueva versión, sin
tocar el resto del sistema. Mientras no exista el repositorio de reglas, la
versión vigente vive aquí.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field

from cotizacion.rating.domain.models import (
    DesgloseCotizacion,
    SolicitudCotizacionMicroseguroVida,
    SolicitudCotizacionParametrico,
    SolicitudCotizacionViaje,
    SolicitudCotizacionVidaHipotecario,
)

TASA_IVA = Decimal("0.19")

# Ramo Viaje

# Ramo Vida Hipotecario
COBERTURAS_ADICIONALES_FACTOR_HIPOTECARIO = Decimal("0.10")

# Ramo Microseguro de Vida
RECARGO_FACTOR_MICROSEGURO = Decimal("0.10")
COBERTURAS_ADICIONALES_FACTOR_MICROSEGURO = Decimal("0.15")

# Ramo Paramétrico
RECARGO_FACTOR_PARAMETRICO = Decimal("0.10")
COBERTURAS_ADICIONALES_FACTOR_PARAMETRICO = Decimal("0.07")


def _iva(base: Decimal) -> Decimal:
    return (base * TASA_IVA).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ReglasRating(BaseModel):
    version: str
    tasa_base_por_mil: dict[str, Decimal]
    factor_edad: list[tuple[int, Decimal]]  # (edad máxima, factor), ordenado
    peso_score: Decimal
    tarifa_viaje_por_dia: dict[str, Decimal] = Field(default_factory=dict)  # COP por día y viajero
    recargo_viaje_por_destino: dict[str, Decimal] = Field(default_factory=dict)  # factor sobre prima básica
    coberturas_adicionales_viaje_por_destino: dict[str, Decimal] = Field(
        default_factory=dict
    )  # factor sobre prima básica
    factor_impuestos: Decimal = Decimal("1.19")  # IVA 19%
    tarifa_parametrico: dict[str, Decimal] = Field(default_factory=dict)
    tasa_vida_hipotecario_por_mil: Decimal = Decimal("0.8")
    tasa_microseguro_por_mil: Decimal = Decimal("1.2")


REGLAS_VIGENTES = ReglasRating(
    version="2026.10.0",
    tasa_base_por_mil={"vida-temporal": Decimal("1.8"), "hogar": Decimal("0.9"), "auto": Decimal("12.5")},
    factor_edad=[(30, Decimal("0.9")), (45, Decimal("1.0")), (60, Decimal("1.35")), (99, Decimal("2.1"))],
    peso_score=Decimal("0.6"),
    tarifa_viaje_por_dia={"viaje-internacional": Decimal("9000")},
    recargo_viaje_por_destino={"Estados Unidos": Decimal("0.03")},
    coberturas_adicionales_viaje_por_destino={"Estados Unidos": Decimal("0.10")},
    tarifa_parametrico={"Retraso de vuelo": Decimal("45000"), "Lluvia excesiva": Decimal("60000")},
    tasa_vida_hipotecario_por_mil=Decimal("0.8"),
    tasa_microseguro_por_mil=Decimal("1.2"),
)


class ProductoNoTarifado(LookupError):
    pass


def risk_factor(reglas: ReglasRating, score: Decimal) -> Decimal:
    """Score neutral 0.5 deja el factor en 1."""
    return Decimal(1) + (score - Decimal("0.5")) * reglas.peso_score


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
    impuestos = _iva(subtotal)
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
    impuestos = _iva(subtotal)
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
    edad = max(18, (ref - solicitud.fecha_nacimiento).days // 365)
    factor_edad = next(f for limite, f in reglas.factor_edad if edad <= limite)
    monto_base = (solicitud.suma_asegurada / Decimal(1000)) * reglas.tasa_microseguro_por_mil * factor_edad
    prima_basica = monto_base.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    recargo_riesgo = (prima_basica * RECARGO_FACTOR_MICROSEGURO).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    coberturas_adicionales = (prima_basica * COBERTURAS_ADICIONALES_FACTOR_MICROSEGURO).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    subtotal = prima_basica + recargo_riesgo + coberturas_adicionales
    impuestos = _iva(subtotal)
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
    edad = max(18, (ref - solicitud.fecha_nacimiento).days // 365)
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
    coberturas_adicionales = (prima_basica * COBERTURAS_ADICIONALES_FACTOR_HIPOTECARIO).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    subtotal = prima_basica + recargo_riesgo + coberturas_adicionales
    impuestos = _iva(subtotal)
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
    tarifa = reglas.tarifa_parametrico.get(solicitud.evento, Decimal("45000")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    prima_basica = tarifa
    recargo_riesgo = (prima_basica * RECARGO_FACTOR_PARAMETRICO).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    coberturas_adicionales = (prima_basica * COBERTURAS_ADICIONALES_FACTOR_PARAMETRICO).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    subtotal = prima_basica + recargo_riesgo + coberturas_adicionales
    impuestos = _iva(subtotal)
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
