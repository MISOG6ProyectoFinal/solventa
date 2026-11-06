"""Repositorio del catálogo: Postgres (fuente de verdad) e InMemory (tests/local sin DB)."""

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    inspect,
    select,
    text,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import Engine

from cotizacion.catalogo.adapters.seed import SEED_PRODUCTOS, SEED_RAMOS
from cotizacion.catalogo.domain.models import Cobertura, MobilePresentation, Producto, Ramo

metadata = MetaData()

ramos = Table(
    "ramos",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("nombre", String(255), nullable=False),
    Column("orden", Integer, nullable=True),
)

productos = Table(
    "productos",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("nombre", String(255), nullable=False),
    Column("ramo_id", String(64), ForeignKey("ramos.id"), nullable=False, index=True),
    Column("activo", Boolean, nullable=False, default=True),
    Column("canales", JSON, nullable=True),
    Column("requiere_consentimiento", Boolean, nullable=True),
    Column("mobile_orden", Integer, nullable=True),
    Column("mobile_descripcion", String(255), nullable=True),
    Column("mobile_precio_desde", Numeric(18, 2), nullable=True),
)

coberturas = Table(
    "coberturas",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("nombre", String(255), nullable=False),
    Column("producto_id", String(64), ForeignKey("productos.id"), nullable=False, index=True),
)


LEGACY_PRODUCT_COLUMNS = {
    "canales": "JSON",
    "requiere_consentimiento": "BOOLEAN",
    "mobile_orden": "INTEGER",
    "mobile_descripcion": "VARCHAR(255)",
    "mobile_precio_desde": "NUMERIC(18, 2)",
}


def _to_line(row) -> Ramo:
    return Ramo(id=row["id"], nombre=row["nombre"], orden=row["orden"] or 0)


def _to_product(row) -> Producto:
    presentacion = None
    if row["mobile_orden"] is not None:
        presentacion = MobilePresentation(
            orden=row["mobile_orden"],
            descripcion=row["mobile_descripcion"],
            precio_desde=row["mobile_precio_desde"],
        )
    return Producto(
        id=row["id"],
        nombre=row["nombre"],
        ramo_id=row["ramo_id"],
        activo=row["activo"],
        canales=row["canales"] or [],
        requiere_consentimiento=bool(row["requiere_consentimiento"]),
        presentacion_mobile=presentacion,
    )


def product_values(producto: Producto) -> dict:
    presentacion = producto.presentacion_mobile
    return {
        "id": producto.id,
        "nombre": producto.nombre,
        "ramo_id": producto.ramo_id,
        "activo": producto.activo,
        "canales": [str(canal) for canal in producto.canales],
        "requiere_consentimiento": producto.requiere_consentimiento,
        "mobile_orden": presentacion.orden if presentacion else None,
        "mobile_descripcion": presentacion.descripcion if presentacion else None,
        "mobile_precio_desde": presentacion.precio_desde if presentacion else None,
    }


class PostgresCatalogoRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)
        self._upgrade_legacy_tables()

    def _upgrade_legacy_tables(self) -> None:
        inspector = inspect(self.engine)
        ramos_columns = {column["name"] for column in inspector.get_columns("ramos")}
        productos_columns = {column["name"] for column in inspector.get_columns("productos")}
        with self.engine.begin() as conn:
            if "orden" not in ramos_columns:
                conn.execute(text("ALTER TABLE ramos ADD COLUMN orden INTEGER"))
            for column, ddl in LEGACY_PRODUCT_COLUMNS.items():
                if column not in productos_columns:
                    conn.execute(text(f"ALTER TABLE productos ADD COLUMN {column} {ddl}"))
            if "disponible_mobile" in productos_columns and self.engine.dialect.name == "postgresql":
                conn.execute(text("ALTER TABLE productos ALTER COLUMN disponible_mobile DROP NOT NULL"))
            for ramo in SEED_RAMOS:
                conn.execute(
                    update(ramos).where(ramos.c.id == ramo.id, ramos.c.orden.is_(None)).values(orden=ramo.orden)
                )
            for producto in SEED_PRODUCTOS:
                values = {
                    key: value for key, value in product_values(producto).items() if key in LEGACY_PRODUCT_COLUMNS
                }
                conn.execute(
                    update(productos)
                    .where(productos.c.id == producto.id, productos.c.canales.is_(None))
                    .values(**values)
                )

    def list_ramos(self) -> list[Ramo]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(ramos)).mappings().all()
        return [_to_line(row) for row in rows]

    def list_productos(self) -> list[Producto]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(productos)).mappings().all()
        return [_to_product(row) for row in rows]

    def list_coberturas(self, producto_id: str | None = None) -> list[Cobertura]:
        stmt = select(coberturas)
        if producto_id is not None:
            stmt = stmt.where(coberturas.c.producto_id == producto_id)
        with self.engine.connect() as conn:
            rows = conn.execute(stmt).mappings().all()
        return [Cobertura(**row) for row in rows]

    def get_producto(self, producto_id: str) -> Producto | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(productos).where(productos.c.id == producto_id)).mappings().first()
        return _to_product(row) if row else None

    def get_ramo(self, ramo_id: str) -> Ramo | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(ramos).where(ramos.c.id == ramo_id)).mappings().first()
        return _to_line(row) if row else None

    def upsert_ramo(self, ramo: Ramo) -> None:
        stmt = pg_insert(ramos).values(**ramo.model_dump())
        stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
        with self.engine.begin() as conn:
            conn.execute(stmt)

    def upsert_producto(self, producto: Producto) -> None:
        stmt = pg_insert(productos).values(**product_values(producto))
        stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
        with self.engine.begin() as conn:
            conn.execute(stmt)

    def upsert_cobertura(self, cobertura: Cobertura) -> None:
        stmt = pg_insert(coberturas).values(**cobertura.model_dump())
        stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
        with self.engine.begin() as conn:
            conn.execute(stmt)


class InMemoryCatalogoRepository:
    def __init__(self) -> None:
        self.ramos: dict[str, Ramo] = {}
        self.productos: dict[str, Producto] = {}
        self.coberturas: dict[str, Cobertura] = {}

    def list_ramos(self) -> list[Ramo]:
        return list(self.ramos.values())

    def list_productos(self) -> list[Producto]:
        return list(self.productos.values())

    def list_coberturas(self, producto_id: str | None = None) -> list[Cobertura]:
        items = list(self.coberturas.values())
        if producto_id is None:
            return items
        return [c for c in items if c.producto_id == producto_id]

    def get_producto(self, producto_id: str) -> Producto | None:
        return self.productos.get(producto_id)

    def get_ramo(self, ramo_id: str) -> Ramo | None:
        return self.ramos.get(ramo_id)

    def upsert_ramo(self, ramo: Ramo) -> None:
        if ramo.id not in self.ramos:
            self.ramos[ramo.id] = ramo

    def upsert_producto(self, producto: Producto) -> None:
        if producto.id not in self.productos:
            self.productos[producto.id] = producto

    def upsert_cobertura(self, cobertura: Cobertura) -> None:
        if cobertura.id not in self.coberturas:
            self.coberturas[cobertura.id] = cobertura
