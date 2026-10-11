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
    Ramo(id="ramo-viaje", nombre="Viaje"),
    Ramo(id="ramo-dispositivos", nombre="Protección de dispositivos"),
    Ramo(id="ramo-microseguro-vida", nombre="Microseguro de vida"),
    Ramo(id="ramo-parametrico", nombre="Paramétrico (clima / vuelo)"),
    Ramo(id="ramo-proteccion-pagos", nombre="Protección de pagos"),
    Ramo(id="ramo-vida-hipotecario", nombre="Vida hipotecario"),
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
    Producto(
        id="viaje-internacional",
        nombre="Viaje Internacional",
        ramo_id="ramo-viaje",
        activo=True,
        disponible_mobile=True,
    ),
    Producto(
        id="proteccion-celular",
        nombre="Protección Celular",
        ramo_id="ramo-dispositivos",
        activo=True,
        disponible_mobile=False,
    ),
    Producto(
        id="vida-esencial",
        nombre="Vida Esencial",
        ramo_id="ramo-microseguro-vida",
        activo=True,
        disponible_mobile=False,
    ),
    Producto(id="parametrico-clima-vuelo", nombre="Paramétrico Clima y Vuelo", ramo_id="ramo-parametrico"),
    Producto(id="proteccion-pagos", nombre="Protección de Pagos", ramo_id="ramo-proteccion-pagos"),
    Producto(id="vida-hipotecario", nombre="Vida Hipotecario", ramo_id="ramo-vida-hipotecario"),
)

SEED_COBERTURAS = (
    Cobertura(id="hogar-incendio", nombre="Incendio", producto_id="hogar"),
    Cobertura(id="hogar-robo", nombre="Robo", producto_id="hogar"),
    Cobertura(id="auto-rc", nombre="Responsabilidad civil", producto_id="auto"),
    Cobertura(id="auto-danos", nombre="Daños materiales", producto_id="auto"),
    Cobertura(id="vida-fallecimiento", nombre="Fallecimiento", producto_id="vida-temporal"),
    Cobertura(id="viaje-gastos-medicos", nombre="Gastos médicos en el exterior", producto_id="viaje-internacional"),
    Cobertura(id="viaje-cancelacion", nombre="Cancelación de viaje", producto_id="viaje-internacional"),
    Cobertura(id="viaje-equipaje", nombre="Pérdida de equipaje", producto_id="viaje-internacional"),
    Cobertura(id="viaje-asistencia", nombre="Asistencia en viaje", producto_id="viaje-internacional"),
    Cobertura(id="celular-dano-accidental", nombre="Daño accidental", producto_id="proteccion-celular"),
    Cobertura(id="celular-robo", nombre="Robo", producto_id="proteccion-celular"),
    Cobertura(id="celular-liquidos", nombre="Daño por líquidos", producto_id="proteccion-celular"),
    Cobertura(id="vida-esencial-fallecimiento", nombre="Fallecimiento", producto_id="vida-esencial"),
    Cobertura(id="vida-esencial-auxilio", nombre="Auxilio funerario", producto_id="vida-esencial"),
    Cobertura(id="parametrico-retraso-vuelo", nombre="Retraso de vuelo", producto_id="parametrico-clima-vuelo"),
    Cobertura(id="parametrico-lluvia", nombre="Lluvia excesiva", producto_id="parametrico-clima-vuelo"),
    Cobertura(id="parametrico-sequia", nombre="Sequía", producto_id="parametrico-clima-vuelo"),
    Cobertura(id="pagos-desempleo", nombre="Desempleo involuntario", producto_id="proteccion-pagos"),
    Cobertura(id="pagos-incapacidad-temporal", nombre="Incapacidad temporal", producto_id="proteccion-pagos"),
    Cobertura(id="pagos-fallecimiento", nombre="Fallecimiento (saldo de la deuda)", producto_id="proteccion-pagos"),
    Cobertura(
        id="hipotecario-fallecimiento", nombre="Fallecimiento (saldo del crédito)", producto_id="vida-hipotecario"
    ),
    Cobertura(id="hipotecario-incapacidad", nombre="Incapacidad total y permanente", producto_id="vida-hipotecario"),
    Cobertura(id="hipotecario-enfermedades", nombre="Enfermedades graves", producto_id="vida-hipotecario"),
)


def seed_catalogo(repo: CatalogoRepository) -> None:
    for ramo in SEED_RAMOS:
        repo.upsert_ramo(ramo)
    for producto in SEED_PRODUCTOS:
        repo.upsert_producto(producto)
    for cobertura in SEED_COBERTURAS:
        repo.upsert_cobertura(cobertura)
