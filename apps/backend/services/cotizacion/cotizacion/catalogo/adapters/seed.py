"""Dataset inicial de desarrollo del catálogo.

Lo ejecuta el bootstrap explícito, y solo si el catálogo está vacío.
No corre en el arranque de las réplicas: PostgreSQL sigue siendo la fuente de verdad.
"""

from cotizacion.catalogo.domain.models import Cobertura, Producto, Ramo
from cotizacion.catalogo.domain.ports import CatalogoRepository

SEED_RAMOS = (
    Ramo(id="ramo-hogar", nombre="Hogar"),
    Ramo(id="ramo-auto", nombre="Automóviles"),
    Ramo(id="ramo-vida", nombre="Vida"),
)

SEED_PRODUCTOS = (
    Producto(
        id="hogar",
        nombre="Seguro Hogar",
        ramo_id="ramo-hogar",
        activo=True,
        disponible_mobile=True,
    ),
    Producto(
        id="auto",
        nombre="Seguro Auto",
        ramo_id="ramo-auto",
        activo=True,
        disponible_mobile=True,
    ),
    Producto(
        id="vida-temporal",
        nombre="Vida Temporal",
        ramo_id="ramo-vida",
        activo=True,
        disponible_mobile=False,
    ),
)

SEED_COBERTURAS = (
    Cobertura(id="hogar-incendio", nombre="Incendio", producto_id="hogar"),
    Cobertura(id="hogar-robo", nombre="Robo", producto_id="hogar"),
    Cobertura(id="auto-rc", nombre="Responsabilidad civil", producto_id="auto"),
    Cobertura(id="auto-danos", nombre="Daños materiales", producto_id="auto"),
    Cobertura(id="vida-fallecimiento", nombre="Fallecimiento", producto_id="vida-temporal"),
)


def seed_catalogo(repo: CatalogoRepository) -> None:
    for ramo in SEED_RAMOS:
        repo.upsert_ramo(ramo)
    for producto in SEED_PRODUCTOS:
        repo.upsert_producto(producto)
    for cobertura in SEED_COBERTURAS:
        repo.upsert_cobertura(cobertura)
