import logging
import os
import socket
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Response
from pydantic import BaseModel, Field

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("cotizacion")

IVA = 0.19
VIGENCIA_HORAS = 24
PRIMAS_BASE = {
    "viajes": 80_000.0,
    "microseguros": 25_000.0,
    "vida_hipotecario": 350_000.0,
    "parametrico": 120_000.0,
}


def nombre_instancia() -> str:
    return os.environ.get("HOSTNAME") or socket.gethostname()


class MonitorSalud:
    """Estado de esta réplica para el readiness probe. Vive en memoria."""

    def __init__(self) -> None:
        self.listo = True

    def fallar(self) -> None:
        self.listo = False

    def recuperar(self) -> None:
        self.listo = True


monitor = MonitorSalud()
app = FastAPI(title="Cotización y Rating", version="0.1.0")


class SolicitudCotizacion(BaseModel):
    cliente_id: str = Field(min_length=1)
    ramo: str = "viajes"
    producto_id: str | None = None
    socio_id: str | None = None


class OfertaCotizacion(BaseModel):
    id: str
    cliente_id: str
    producto_id: str
    socio_id: str | None
    prima: float
    impuestos: float
    estado: str
    vigenciaOferta: datetime
    instancia: str


class EstadoSalud(BaseModel):
    estado: str
    instancia: str


def calcular_prima(ramo: str) -> float:
    return PRIMAS_BASE.get(ramo.lower(), PRIMAS_BASE["viajes"])


@app.get("/health")
def health(response: Response) -> EstadoSalud:
    instancia = nombre_instancia()
    if not monitor.listo:
        response.status_code = 503
        return EstadoSalud(estado="no_listo", instancia=instancia)
    return EstadoSalud(estado="ok", instancia=instancia)


@app.post("/cotizaciones")
def cotizar(solicitud: SolicitudCotizacion) -> OfertaCotizacion:
    ramo = solicitud.ramo.lower()
    prima = calcular_prima(ramo)
    impuestos = round(prima * IVA, 2)
    oferta = OfertaCotizacion(
        id=str(uuid.uuid4()),
        cliente_id=solicitud.cliente_id,
        producto_id=solicitud.producto_id or f"prod-{ramo}",
        socio_id=solicitud.socio_id,
        prima=prima,
        impuestos=impuestos,
        estado="ofertada",
        vigenciaOferta=datetime.now(timezone.utc) + timedelta(hours=VIGENCIA_HORAS),
        instancia=nombre_instancia(),
    )
    logger.info(
        "instancia=%s cotizacion id=%s ramo=%s prima=%s",
        oferta.instancia,
        oferta.id,
        ramo,
        prima,
    )
    return oferta


@app.post("/experimentos/falla-salud")
def falla_salud() -> EstadoSalud:
    monitor.fallar()
    instancia = nombre_instancia()
    logger.warning("instancia=%s health forzado a 503", instancia)
    return EstadoSalud(estado="no_listo", instancia=instancia)


@app.post("/experimentos/recupera-salud")
def recupera_salud() -> EstadoSalud:
    monitor.recuperar()
    instancia = nombre_instancia()
    logger.info("instancia=%s health restaurado a 200", instancia)
    return EstadoSalud(estado="ok", instancia=instancia)
