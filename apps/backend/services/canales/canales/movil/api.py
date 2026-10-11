from datetime import date
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator, model_validator
from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion, siniestros

router = APIRouter(prefix="/movil", tags=["BFF Móvil"])


class SolicitudCotizacionMovil(BaseModel):
    producto_id: str
    nombre: str
    cedula: str
    destino: Literal["Estados Unidos", "España", "México", "Otro país"]
    fecha_salida: date
    fecha_regreso: date
    viajeros: int = Field(ge=1)

    @field_validator("nombre")
    @classmethod
    def _nombre_obligatorio(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El nombre es obligatorio")
        return value.strip()

    @field_validator("cedula")
    @classmethod
    def _cedula_numerica(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("La cédula es obligatoria")
        if not value.isdigit():
            raise ValueError("La cédula debe contener solo dígitos")
        return value

    @model_validator(mode="after")
    def _fechas_validas(self) -> "SolicitudCotizacionMovil":
        if self.fecha_salida < date.today():
            raise ValueError("La fecha de salida no puede ser anterior a hoy")
        if self.fecha_regreso <= self.fecha_salida:
            raise ValueError("La fecha de regreso debe ser posterior a la salida")
        return self


@router.get("/")
def info() -> dict:
    return {"component": "BFF Móvil"}


@router.get("/productos")
def listar_productos() -> list:
    """Catálogo de productos del canal Mobile (vía servicio de Cotización)."""
    return call_upstream(cotizacion.get, "/catalogo/productos")


@router.post("/cotizaciones")
def cotizar(solicitud: SolicitudCotizacionMovil) -> dict:
    """Valida el formulario, delega en el consenso sin PII y devuelve la oferta completa."""
    return call_upstream(
        cotizacion.post,
        "/consenso/cotizaciones",
        json=solicitud.model_dump(mode="json", exclude={"nombre", "cedula"}),
        headers={"X-Canal": "mobile"},
    )


@router.post("/siniestros", status_code=201)
def reportar_siniestro(aviso: dict) -> dict:
    return call_upstream(siniestros.post, "/siniestros/avisos", json=aviso)


@router.post("/siniestros/{aviso_id}/evidencias/cargas", status_code=201)
def solicitar_carga(aviso_id: str, carga: dict) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/evidencias/cargas",
        json=carga,
    )


@router.post("/siniestros/{aviso_id}/evidencias/{evidencia_id}/confirmar")
def confirmar_carga(aviso_id: str, evidencia_id: str) -> dict:
    return call_upstream(
        siniestros.post,
        f"/siniestros/avisos/{aviso_id}/evidencias/{evidencia_id}/confirmar",
    )


@router.get("/siniestros/{aviso_id}/evidencias")
def listar_evidencias(aviso_id: str):
    return call_upstream(siniestros.get, f"/siniestros/avisos/{aviso_id}/evidencias")
