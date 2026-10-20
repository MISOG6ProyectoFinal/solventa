"""Reglas de rating como configuración versionada.

Actuaría cambia la tabla de tasas y factores publicando una nueva versión, sin
tocar el resto del sistema. Mientras no exista el repositorio de reglas, la
versión vigente vive aquí.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field

from cotizacion.rating.domain.models import (
    SolicitudCotizacionMicroseguroVida,
    SolicitudCotizacionParametrico,
    SolicitudCotizacionViaje,
    SolicitudCotizacionVidaHipotecario,
)


class ReglasRating(BaseModel):
    version: str
    tasa_base_por_mil: dict[str, Decimal]
    factor_edad: list[tuple[int, Decimal]]  # (edad máxima, factor), ordenado
    peso_score: Decimal
    tarifa_viaje_por_dia: dict[str, Decimal] = Field(default_factory=dict)  # COP por día y viajero
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
    tarifa_parametrico={"Retraso de vuelo": Decimal("45000"), "Lluvia excesiva": Decimal("60000")},
    tasa_vida_hipotecario_por_mil=Decimal("0.8"),
    tasa_microseguro_por_mil=Decimal("1.2"),
)


class ProductoNoTarifado(LookupError):
    pass


def factor_riesgo(reglas: ReglasRating, score: Decimal) -> Decimal:
    """Score neutral 0.5 deja el factor en 1."""
    return Decimal(1) + (score - Decimal("0.5")) * reglas.peso_score


def calcular_prima(reglas: ReglasRating, producto_id: str, suma: Decimal, edad: int, score: Decimal) -> Decimal:
    try:
        tasa = reglas.tasa_base_por_mil[producto_id]
    except KeyError as exc:
        raise ProductoNoTarifado(producto_id) from exc
    factor_edad = next(f for limite, f in reglas.factor_edad if edad <= limite)
    prima = suma / Decimal(1000) * tasa * factor_edad * factor_riesgo(reglas, score)
    return prima.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calcular_prima_viaje(reglas: ReglasRating, solicitud: SolicitudCotizacionViaje) -> Decimal:
    """Tarifa diaria × días de viaje × viajeros × impuestos."""
    try:
        tarifa_dia = reglas.tarifa_viaje_por_dia[solicitud.producto_id]
    except KeyError as exc:
        raise ProductoNoTarifado(solicitud.producto_id) from exc
    dias = (solicitud.fecha_regreso - solicitud.fecha_salida).days
    prima = tarifa_dia * dias * solicitud.viajeros * reglas.factor_impuestos
    return prima.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calcular_prima_microseguro_vida(
    reglas: ReglasRating, solicitud: SolicitudCotizacionMicroseguroVida, fecha_referencia: date | None = None
) -> Decimal:
    """Suma asegurada / 1000 × tasa base × factor edad."""
    ref = fecha_referencia or date.today()
    edad = max(18, (ref - solicitud.fecha_nacimiento).days // 365)
    factor_edad = next(f for limite, f in reglas.factor_edad if edad <= limite)
    prima = (solicitud.suma_asegurada / Decimal(1000)) * reglas.tasa_microseguro_por_mil * factor_edad
    return prima.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calcular_prima_vida_hipotecario(
    reglas: ReglasRating, solicitud: SolicitudCotizacionVidaHipotecario, fecha_referencia: date | None = None
) -> Decimal:
    """Valor crédito / 1000 × tasa anual × factor edad × plazo en años × factor del score de Open Finance."""
    ref = fecha_referencia or date.today()
    edad = max(18, (ref - solicitud.fecha_nacimiento).days // 365)
    factor_edad = next(f for limite, f in reglas.factor_edad if edad <= limite)
    prima = (
        (solicitud.valor_credito / Decimal(1000))
        * reglas.tasa_vida_hipotecario_por_mil
        * factor_edad
        * Decimal(solicitud.plazo_anios)
        * factor_riesgo(reglas, solicitud.score_riesgo)
    )
    return prima.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calcular_prima_parametrico(reglas: ReglasRating, solicitud: SolicitudCotizacionParametrico) -> Decimal:
    """Tarifa fija según el evento asegurado."""
    tarifa = reglas.tarifa_parametrico.get(solicitud.evento, Decimal("45000"))
    return tarifa.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
