from datetime import date
from decimal import Decimal

import pytest
from cotizacion.main import app
from cotizacion.rating.domain.devolucion import SolicitudDevolucion, calcular_devolucion
from fastapi.testclient import TestClient
from pydantic import ValidationError

client = TestClient(app)


def _solicitud(cancelacion: date, **overrides) -> SolicitudDevolucion:
    datos = {
        "prima": Decimal(365000),
        "fecha_inicio": date(2026, 1, 1),
        "fecha_fin": date(2027, 1, 1),
        "fecha_cancelacion": cancelacion,
    }
    return SolicitudDevolucion(**{**datos, **overrides})


def test_prorratea_los_dias_no_devengados():
    resultado = calcular_devolucion(_solicitud(date(2026, 7, 2)))
    assert resultado.dias_vigencia == 365
    assert resultado.dias_no_devengados == 183
    assert resultado.monto_reintegro == Decimal(183000)


def test_cancelar_el_primer_dia_devuelve_toda_la_prima():
    assert calcular_devolucion(_solicitud(date(2026, 1, 1))).monto_reintegro == Decimal(365000)


def test_cancelar_el_ultimo_dia_no_devuelve_nada():
    assert calcular_devolucion(_solicitud(date(2027, 1, 1))).monto_reintegro == Decimal(0)


def test_causa_no_reembolsable_devuelve_cero():
    resultado = calcular_devolucion(_solicitud(date(2026, 7, 2), reembolsable=False))
    assert resultado.monto_reintegro == Decimal(0)
    assert resultado.dias_no_devengados == 183


def test_fecha_fuera_de_vigencia_se_rechaza():
    with pytest.raises(ValidationError):
        _solicitud(date(2027, 2, 1))


def test_endpoint_devuelve_el_monto_exacto():
    response = client.post(
        "/cotizaciones/devolucion",
        json={
            "prima": "365000",
            "fecha_inicio": "2026-01-01",
            "fecha_fin": "2027-01-01",
            "fecha_cancelacion": "2026-07-02",
            "reembolsable": True,
        },
    )
    assert response.status_code == 200
    assert Decimal(str(response.json()["monto_reintegro"])) == Decimal(183000)


def test_endpoint_rechaza_fechas_invalidas():
    response = client.post(
        "/cotizaciones/devolucion",
        json={
            "prima": "1000",
            "fecha_inicio": "2026-01-01",
            "fecha_fin": "2026-12-31",
            "fecha_cancelacion": "2025-01-01",
        },
    )
    assert response.status_code == 422
