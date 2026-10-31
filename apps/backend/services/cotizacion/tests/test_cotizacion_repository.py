from datetime import UTC, date, datetime
from decimal import Decimal

from cotizacion.consenso.adapters.cotizacion_repository import PostgresCotizacionRepository
from cotizacion.consenso.adapters.cotizacion_repository import cotizaciones as quotes_table
from cotizacion.consenso.domain.models import OfertaCotizacion, VigenciaPropuesta
from cotizacion.signals.domain.models import AppliedSignal, DegradationReason, SignalOrigin
from solventa_common.vigencia_cotizacion import ZONA_COTIZACION
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.pool import StaticPool

LIMITE = datetime(2026, 10, 19, 23, 59, 59, tzinfo=ZONA_COTIZACION)


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
        vigente_hasta=LIMITE,
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
    assert {"datos_riesgo", "canal", "vigente_hasta", "cliente_id", "degradada", "senales"} <= columnas
    assert repositorio.count() == 1


def test_create_schema_se_puede_repetir_sobre_el_esquema_vigente():
    repositorio = PostgresCotizacionRepository(_engine())

    repositorio.create_schema()
    repositorio.create_schema()
    repositorio.save(_oferta())

    assert repositorio.count() == 1


def test_persiste_y_recupera_vigente_hasta():
    repositorio = PostgresCotizacionRepository(_engine())
    repositorio.create_schema()
    oferta = _oferta()

    repositorio.save(oferta)
    guardada = repositorio.get(oferta.id)

    assert guardada is not None
    assert guardada.vigente_hasta == LIMITE
    assert guardada.cliente_id is None
    assert repositorio.get("no-existe") is None


def test_persiste_el_cliente_de_la_cotizacion_movil():
    repositorio = PostgresCotizacionRepository(_engine())
    repositorio.create_schema()
    oferta = _oferta().model_copy(update={"cliente_id": "cliente-1"})

    repositorio.save(oferta)
    guardada = repositorio.get(oferta.id)

    assert guardada is not None
    assert guardada.cliente_id == "cliente-1"


def test_stores_degraded_flag_and_applied_signal():
    engine = _engine()
    repository = PostgresCotizacionRepository(engine)
    repository.create_schema()
    signal = AppliedSignal(
        fuente="open-finance",
        origen=SignalOrigin.CACHE,
        score_riesgo=Decimal("0.7"),
        latencia_ms=301,
        motivo=DegradationReason.TIMEOUT,
        obtenido_en=datetime(2026, 10, 28, 15, 30, tzinfo=UTC),
    )

    repository.save(_oferta().model_copy(update={"degradada": True, "senales": [signal]}))

    with engine.connect() as conn:
        row = conn.execute(select(quotes_table)).mappings().one()
    assert row["degradada"] is True
    assert row["senales"] == [
        {
            "fuente": "open-finance",
            "origen": "cache",
            "score_riesgo": "0.7",
            "latencia_ms": 301,
            "motivo": "timeout",
            "obtenido_en": "2026-10-28T15:30:00Z",
        }
    ]
    assert repository.get(row["id"]).senales == [signal]
