"""La vigencia para pagar la oferta termina el día en que se generó."""

from datetime import UTC, datetime, timedelta

from solventa_common.vigencia_cotizacion import (
    FIN_DE_DIA,
    VIGENTE_HASTA_DESCONOCIDO,
    ZONA_COTIZACION,
    calcular_vigente_hasta,
    oferta_se_puede_cobrar,
)


def test_el_limite_es_el_fin_del_dia_civil_de_colombia():
    generada = datetime(2026, 10, 19, 8, 15, tzinfo=ZONA_COTIZACION)
    limite = calcular_vigente_hasta(generada)
    assert limite == datetime(2026, 10, 19, 23, 59, 59, tzinfo=ZONA_COTIZACION)
    assert limite.timetz() == FIN_DE_DIA.replace(tzinfo=ZONA_COTIZACION)


def test_un_reloj_ingenuo_se_interpreta_en_colombia():
    limite = calcular_vigente_hasta(datetime(2026, 10, 19, 8, 15))
    assert limite == datetime(2026, 10, 19, 23, 59, 59, tzinfo=ZONA_COTIZACION)


def test_el_dia_se_toma_en_colombia_aunque_el_reloj_venga_en_utc():
    # 20 oct 02:30 UTC sigue siendo 19 oct 21:30 en Colombia.
    generada = datetime(2026, 10, 20, 2, 30, tzinfo=UTC)
    limite = calcular_vigente_hasta(generada)
    assert limite == datetime(2026, 10, 19, 23, 59, 59, tzinfo=ZONA_COTIZACION)


def test_sin_instante_explicito_usa_el_dia_actual_en_colombia():
    antes = datetime.now(ZONA_COTIZACION)
    limite = calcular_vigente_hasta()
    despues = datetime.now(ZONA_COTIZACION)
    assert limite.timetz() == FIN_DE_DIA.replace(tzinfo=ZONA_COTIZACION)
    assert antes.date() <= limite.date() <= despues.date()
    assert oferta_se_puede_cobrar(limite)


def test_se_puede_cobrar_hasta_el_instante_limite_y_no_despues():
    limite = datetime(2026, 10, 19, 23, 59, 59, tzinfo=ZONA_COTIZACION)
    assert oferta_se_puede_cobrar(limite, limite)
    assert oferta_se_puede_cobrar(limite.isoformat(), limite)
    assert not oferta_se_puede_cobrar(limite, limite + timedelta(seconds=1))


def test_sin_limite_o_sin_zona_no_se_puede_cobrar():
    assert not oferta_se_puede_cobrar(None)
    assert not oferta_se_puede_cobrar("")
    assert not oferta_se_puede_cobrar(datetime(2026, 10, 19, 23, 59, 59))
    assert not oferta_se_puede_cobrar(VIGENTE_HASTA_DESCONOCIDO, datetime(2026, 10, 19, tzinfo=ZONA_COTIZACION))


def test_un_reloj_ingenuo_de_verificacion_se_interpreta_en_colombia():
    limite = datetime(2026, 10, 19, 23, 59, 59, tzinfo=ZONA_COTIZACION)
    assert oferta_se_puede_cobrar(limite, datetime(2026, 10, 19, 12, 0))
