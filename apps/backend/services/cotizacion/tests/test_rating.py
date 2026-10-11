from datetime import date
from decimal import Decimal

import pytest
from cotizacion.rating.domain.models import SolicitudCotizacionViaje
from cotizacion.rating.domain.rating import (
    REGLAS_VIGENTES,
    ProductoNoTarifado,
    calcular_prima,
    calcular_prima_viaje,
)


def solicitud_viaje(**overrides) -> SolicitudCotizacionViaje:
    datos = {
        "producto_id": "viaje-internacional",
        "destino": "España",
        "fecha_salida": date(2026, 10, 10),
        "fecha_regreso": date(2026, 10, 24),
        "viajeros": 1,
    } | overrides
    return SolicitudCotizacionViaje(**datos)


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


def test_prima_viaje_catorce_dias_un_viajero():
    # 9000 × 14 días × 1 viajero × 1.19
    assert calcular_prima_viaje(REGLAS_VIGENTES, solicitud_viaje()) == Decimal("149940.00")


def test_prima_viaje_catorce_dias_dos_viajeros():
    # 9000 × 14 días × 2 viajeros × 1.19
    assert calcular_prima_viaje(REGLAS_VIGENTES, solicitud_viaje(viajeros=2)) == Decimal("299880.00")


def test_viaje_sin_tarifa():
    with pytest.raises(ProductoNoTarifado):
        calcular_prima_viaje(REGLAS_VIGENTES, solicitud_viaje(producto_id="viaje-nacional"))


def test_solicitud_viaje_exige_regreso_posterior():
    with pytest.raises(ValueError):
        solicitud_viaje(fecha_regreso=date(2026, 10, 10))
