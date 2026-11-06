"""Reglas de rating iniciales. Las carga el bootstrap explícito, y solo si no hay ninguna versión publicada."""

from decimal import Decimal

from cotizacion.rating.domain.ports import RulesRepository
from cotizacion.rating.domain.rating import ReglasRating

INITIAL_RULES = ReglasRating(
    version="2026.10.0",
    tasa_iva=Decimal("0.19"),
    tasa_base_por_mil={"vida-temporal": Decimal("1.8"), "hogar": Decimal("0.9"), "auto": Decimal("12.5")},
    factor_edad=[(30, Decimal("0.9")), (45, Decimal("1.0")), (60, Decimal("1.35")), (99, Decimal("2.1"))],
    peso_score=Decimal("0.6"),
    tarifa_viaje_por_dia={"viaje-internacional": Decimal("9000")},
    recargo_viaje_por_destino={"Estados Unidos": Decimal("0.03")},
    coberturas_adicionales_viaje_por_destino={"Estados Unidos": Decimal("0.10")},
    tarifa_parametrico={"Retraso de vuelo": Decimal("45000"), "Lluvia excesiva": Decimal("60000")},
    tarifa_parametrico_por_defecto=Decimal("45000"),
    recargo_factor_parametrico=Decimal("0.10"),
    coberturas_adicionales_factor_parametrico=Decimal("0.07"),
    tasa_vida_hipotecario_por_mil=Decimal("0.8"),
    coberturas_adicionales_factor_hipotecario=Decimal("0.10"),
    tasa_microseguro_por_mil=Decimal("1.2"),
    recargo_factor_microseguro=Decimal("0.10"),
    coberturas_adicionales_factor_microseguro=Decimal("0.15"),
)


def seed_rules(repo: RulesRepository) -> None:
    repo.publish(INITIAL_RULES)
