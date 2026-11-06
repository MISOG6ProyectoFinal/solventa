"""Dataset inicial de desarrollo del catálogo.

Lo ejecuta el bootstrap explícito, y solo si el catálogo está vacío.
No corre en el arranque de las réplicas: PostgreSQL sigue siendo la fuente de verdad.
"""

from decimal import Decimal

from cotizacion.catalogo.domain.models import Canal, Cobertura, MobilePresentation, Producto, Ramo
from cotizacion.catalogo.domain.ports import CatalogoRepository

SEED_RAMOS = (
    Ramo(id="ramo-hogar", nombre="Hogar", orden=1),
    Ramo(id="ramo-auto", nombre="Automóviles", orden=2),
    Ramo(id="ramo-vida", nombre="Vida", orden=3),
    Ramo(id="ramo-viaje", nombre="Viaje", orden=4),
    Ramo(id="ramo-dispositivos", nombre="Protección de dispositivos", orden=5),
    Ramo(id="ramo-microseguro-vida", nombre="Microseguro de vida", orden=6),
    Ramo(id="ramo-parametrico", nombre="Paramétrico (clima / vuelo)", orden=7),
    Ramo(id="ramo-proteccion-pagos", nombre="Protección de pagos", orden=8),
    Ramo(id="ramo-vida-hipotecario", nombre="Vida hipotecario", orden=9),
)

SEED_PRODUCTOS = (
    Producto(id="hogar", nombre="Seguro Hogar", ramo_id="ramo-hogar"),
    Producto(id="auto", nombre="Seguro Auto", ramo_id="ramo-auto"),
    Producto(id="vida-temporal", nombre="Vida Temporal", ramo_id="ramo-vida"),
    Producto(
        id="viaje-internacional",
        nombre="Viaje Internacional",
        ramo_id="ramo-viaje",
        canales=[Canal.MOBILE, Canal.WEB, Canal.SOCIOS],
        presentacion_mobile=MobilePresentation(
            orden=1,
            descripcion="Gastos médicos, equipaje y asistencia en viaje",
            precio_desde=Decimal("120000"),
        ),
    ),
    Producto(
        id="proteccion-celular",
        nombre="Protección Celular",
        ramo_id="ramo-dispositivos",
        canales=[Canal.SOCIOS],
        presentacion_mobile=MobilePresentation(
            orden=2,
            descripcion="Daño accidental, robo y líquidos",
            precio_desde=Decimal("250000"),
        ),
    ),
    Producto(
        id="vida-esencial",
        nombre="Vida Esencial",
        ramo_id="ramo-microseguro-vida",
        canales=[Canal.WEB, Canal.SOCIOS],
        presentacion_mobile=MobilePresentation(
            orden=3,
            descripcion="Fallecimiento y auxilio funerario",
            precio_desde=Decimal("96000"),
        ),
    ),
    Producto(
        id="parametrico-clima-vuelo",
        nombre="Paramétrico Clima y Vuelo",
        ramo_id="ramo-parametrico",
        canales=[Canal.WEB, Canal.SOCIOS],
    ),
    Producto(
        id="proteccion-pagos",
        nombre="Protección de Pagos",
        ramo_id="ramo-proteccion-pagos",
        canales=[Canal.SOCIOS],
        requiere_consentimiento=True,
    ),
    Producto(
        id="vida-hipotecario",
        nombre="Vida Hipotecario",
        ramo_id="ramo-vida-hipotecario",
        canales=[Canal.WEB, Canal.SOCIOS],
        requiere_consentimiento=True,
    ),
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
