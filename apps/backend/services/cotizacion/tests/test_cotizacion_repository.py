from datetime import date
from decimal import Decimal

from cotizacion.consenso.adapters.cotizacion_repository import PostgresCotizacionRepository
from cotizacion.consenso.adapters.cotizacion_repository import cotizaciones as tabla
from cotizacion.consenso.domain.models import OfertaCotizacion, VigenciaPropuesta
from cotizacion.senales.domain.models import OrigenSenal, SenalAplicada
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.pool import StaticPool


def _engine():
    return create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})


def _oferta() -> OfertaCotizacion:
    return OfertaCotizacion(
        producto_id="viaje-internacional",
        prima=Decimal("214200.00"),
        vigencia_propuesta=VigenciaPropuesta(desde=date(2026, 11, 20), hasta=date(2026, 11, 30)),
        version_reglas="2026.10.0",
        datos_riesgo={"destino": "España"},
        canal="mobile",
    )


def test_create_schema_agrega_las_columnas_que_faltan_en_una_tabla_existente():
    engine = _engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE cotizaciones (id VARCHAR(36) PRIMARY KEY, producto_id VARCHAR(64) NOT NULL, "
                "prima NUMERIC(18, 2) NOT NULL, coberturas JSON NOT NULL, vigencia_desde DATE NOT NULL, "
                "vigencia_hasta DATE NOT NULL, version_reglas VARCHAR(64) NOT NULL)"
            )
        )
    repositorio = PostgresCotizacionRepository(engine)

    repositorio.create_schema()
    repositorio.save(_oferta())

    columnas = {columna["name"] for columna in inspect(engine).get_columns("cotizaciones")}
    assert {"datos_riesgo", "canal", "degradada", "senales"} <= columnas
    assert repositorio.count() == 1


def test_create_schema_se_puede_repetir_sobre_el_esquema_vigente():
    repositorio = PostgresCotizacionRepository(_engine())

    repositorio.create_schema()
    repositorio.create_schema()
    repositorio.save(_oferta())

    assert repositorio.count() == 1


def test_persiste_la_marca_degradada_y_la_senal_usada():
    engine = _engine()
    repositorio = PostgresCotizacionRepository(engine)
    repositorio.create_schema()
    senal = SenalAplicada(fuente="open-finance", origen=OrigenSenal.CACHE, score_riesgo=Decimal("0.7"), latencia_ms=301)

    repositorio.save(_oferta().model_copy(update={"degradada": True, "senales": [senal]}))

    with engine.connect() as conn:
        fila = conn.execute(select(tabla)).mappings().one()
    assert fila["degradada"] is True
    assert fila["senales"] == [{"fuente": "open-finance", "origen": "cache", "score_riesgo": "0.7", "latencia_ms": 301}]
