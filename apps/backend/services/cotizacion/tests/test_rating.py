from datetime import date
from decimal import Decimal

import pytest
from cotizacion.rating.domain.models import (
    SolicitudCotizacionMicroseguroVida,
    SolicitudCotizacionParametrico,
    SolicitudCotizacionViaje,
    SolicitudCotizacionVidaHipotecario,
)
from cotizacion.rating.domain.rating import (
    REGLAS_VIGENTES,
    ProductoNoTarifado,
    calcular_desglose_microseguro_vida,
    calcular_desglose_parametrico,
    calcular_desglose_viaje,
    calcular_desglose_vida_hipotecario,
    calcular_prima,
    calcular_prima_microseguro_vida,
    calcular_prima_parametrico,
    calcular_prima_viaje,
    calcular_prima_vida_hipotecario,
)


def solicitud_viaje(**overrides) -> SolicitudCotizacionViaje:
    datos = {
        "producto_id": "viaje-internacional",
        "destino": "España",
        "fecha_salida": date(2026, 10, 10),
        "fecha_regreso": date(2026, 10, 24),
        "viajeros": 1,
        **overrides,
    }
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


def test_prima_microseguro_vida():
    solicitud = SolicitudCotizacionMicroseguroVida(
        producto_id="vida-esencial",
        fecha_nacimiento=date(1996, 1, 1),
        suma_asegurada=Decimal("15000000"),
        beneficiario="Carlos Pérez",
        parentesco="Hijo(a)",
    )
    # 15M / 1000 * 1.2 * factor_edad 0.9 = 16200.00 + recargo + adicionales + IVA = 24097.50
    prima = calcular_prima_microseguro_vida(REGLAS_VIGENTES, solicitud, fecha_referencia=date(2026, 10, 1))
    assert prima == Decimal("24097.50")


def test_prima_vida_hipotecario():
    solicitud = SolicitudCotizacionVidaHipotecario(
        producto_id="vida-hipotecario",
        fecha_nacimiento=date(1986, 1, 1),
        entidad="Banco Aurora",
        valor_credito=Decimal("250000000"),
        plazo_anios=15,
    )
    # 250M / 1000 * 0.8 * factor_edad 1.0 * 15 = 3000000.00 + recargo + adicionales + IVA = 4462500.00
    prima = calcular_prima_vida_hipotecario(REGLAS_VIGENTES, solicitud, fecha_referencia=date(2026, 10, 1))
    assert prima == Decimal("4462500.00")


def test_mortgage_life_premium_applies_open_finance_score():
    solicitud = SolicitudCotizacionVidaHipotecario(
        producto_id="vida-hipotecario",
        fecha_nacimiento=date(1986, 1, 1),
        entidad="Banco Aurora",
        valor_credito=Decimal("250000000"),
        plazo_anios=15,
        score_riesgo=Decimal("0.7"),
    )
    # 3000000 básica + 504000 recargo score + 300000 adicionales + 722760 IVA = 4526760.00
    prima = calcular_prima_vida_hipotecario(REGLAS_VIGENTES, solicitud, fecha_referencia=date(2026, 10, 1))
    assert prima == Decimal("4526760.00")


def test_prima_parametrico():
    solicitud = SolicitudCotizacionParametrico(
        producto_id="parametrico-clima-vuelo",
        evento="Retraso de vuelo",
        referencia="AN-412",
        fecha_evento=date(2026, 11, 15),
        valor_indemnizar=Decimal("500000"),
    )
    prima = calcular_prima_parametrico(REGLAS_VIGENTES, solicitud)
    assert prima == Decimal("62653.50")


def test_desglose_viaje_mockup_estados_unidos():
    solicitud = SolicitudCotizacionViaje(
        producto_id="viaje-internacional",
        destino="Estados Unidos",
        fecha_salida=date(2026, 10, 2),
        fecha_regreso=date(2026, 10, 12),
        viajeros=1,
    )
    desglose = calcular_desglose_viaje(REGLAS_VIGENTES, solicitud)
    assert desglose.prima_basica == Decimal("252000.00")
    assert desglose.recargo_riesgo == Decimal("7560.00")
    assert desglose.coberturas_adicionales == Decimal("25200.00")
    assert desglose.impuestos == Decimal("54104.00")
    assert desglose.total == Decimal("338864.00")


def test_desglose_vida_hipotecario():
    solicitud = SolicitudCotizacionVidaHipotecario(
        producto_id="vida-hipotecario",
        fecha_nacimiento=date(1986, 1, 1),
        entidad="Banco Aurora",
        valor_credito=Decimal("250000000"),
        plazo_anios=15,
        score_riesgo=Decimal("0.7"),
    )
    desglose = calcular_desglose_vida_hipotecario(REGLAS_VIGENTES, solicitud, fecha_referencia=date(2026, 10, 1))
    assert desglose.prima_basica == Decimal("3000000.00")
    assert desglose.recargo_riesgo == Decimal("504000.00")
    assert desglose.coberturas_adicionales == Decimal("300000.00")
    assert desglose.impuestos == Decimal("722760.00")
    assert desglose.total == Decimal("4526760.00")


def test_desglose_microseguro_vida():
    solicitud = SolicitudCotizacionMicroseguroVida(
        producto_id="vida-esencial",
        fecha_nacimiento=date(1996, 1, 1),
        suma_asegurada=Decimal("15000000"),
        beneficiario="Carlos Pérez",
        parentesco="Hijo(a)",
    )
    desglose = calcular_desglose_microseguro_vida(REGLAS_VIGENTES, solicitud, fecha_referencia=date(2026, 10, 1))
    assert desglose.prima_basica == Decimal("16200.00")
    assert desglose.recargo_riesgo == Decimal("1620.00")
    assert desglose.coberturas_adicionales == Decimal("2430.00")
    assert desglose.impuestos == Decimal("3847.50")
    assert desglose.total == Decimal("24097.50")


def test_desglose_parametrico():
    solicitud = SolicitudCotizacionParametrico(
        producto_id="parametrico-clima-vuelo",
        evento="Retraso de vuelo",
        referencia="AN-412",
        fecha_evento=date(2026, 11, 15),
        valor_indemnizar=Decimal("500000"),
    )
    desglose = calcular_desglose_parametrico(REGLAS_VIGENTES, solicitud)
    assert desglose.prima_basica == Decimal("45000.00")
    assert desglose.recargo_riesgo == Decimal("4500.00")
    assert desglose.coberturas_adicionales == Decimal("3150.00")
    assert desglose.impuestos == Decimal("10003.50")
    assert desglose.total == Decimal("62653.50")
