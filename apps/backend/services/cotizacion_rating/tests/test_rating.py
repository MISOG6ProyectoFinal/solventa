from decimal import Decimal

import pytest
from cotizacion_rating.domain.rating import REGLAS_VIGENTES, ProductoNoTarifado, calcular_prima


def test_prima_neutral_score():
    # 100M * 1.8/1000 * factor edad 1.0 * factor score 1.0
    assert calcular_prima(REGLAS_VIGENTES, "vida-temporal", Decimal(100_000_000), 40, Decimal("0.5")) == Decimal(
        "180000.00"
    )


def test_mayor_riesgo_sube_prima():
    base = calcular_prima(REGLAS_VIGENTES, "hogar", Decimal(1_000_000), 40, Decimal("0.5"))
    riesgosa = calcular_prima(REGLAS_VIGENTES, "hogar", Decimal(1_000_000), 40, Decimal("0.9"))
    assert riesgosa > base


def test_producto_sin_tarifa():
    with pytest.raises(ProductoNoTarifado):
        calcular_prima(REGLAS_VIGENTES, "mascotas", Decimal(1), 30, Decimal("0.5"))
