from decimal import Decimal

from pydantic import BaseModel


class EntradaCatalogoMobile(BaseModel):
    producto_id: str
    orden: int
    descripcion: str
    precio_desde: Decimal


CATALOGO_MOBILE = (
    EntradaCatalogoMobile(
        producto_id="viaje-internacional",
        orden=1,
        descripcion="Gastos médicos, equipaje y asistencia en viaje",
        precio_desde=Decimal("120000"),
    ),
    EntradaCatalogoMobile(
        producto_id="proteccion-celular",
        orden=2,
        descripcion="Daño accidental, robo y líquidos",
        precio_desde=Decimal("250000"),
    ),
    EntradaCatalogoMobile(
        producto_id="vida-esencial",
        orden=3,
        descripcion="Fallecimiento y auxilio funerario",
        precio_desde=Decimal("96000"),
    ),
)

PRODUCTOS_CATALOGO_MOBILE = frozenset(entrada.producto_id for entrada in CATALOGO_MOBILE)
