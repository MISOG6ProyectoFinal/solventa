"""Repositorio del catálogo: Postgres (fuente de verdad) e InMemory (tests/local sin DB)."""

from sqlalchemy import Boolean, Column, ForeignKey, MetaData, String, Table, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import Engine

from cotizacion.catalogo.domain.models import Cobertura, Producto, Ramo

metadata = MetaData()

ramos = Table(
    "ramos",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("nombre", String(255), nullable=False),
)

productos = Table(
    "productos",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("nombre", String(255), nullable=False),
    Column("ramo_id", String(64), ForeignKey("ramos.id"), nullable=False, index=True),
    Column("activo", Boolean, nullable=False, default=True),
    Column("disponible_mobile", Boolean, nullable=False, default=False),
)

coberturas = Table(
    "coberturas",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("nombre", String(255), nullable=False),
    Column("producto_id", String(64), ForeignKey("productos.id"), nullable=False, index=True),
)


class PostgresCatalogoRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def create_schema(self) -> None:
        metadata.create_all(self.engine)

    def list_ramos(self) -> list[Ramo]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(ramos)).mappings().all()
        return [Ramo(**row) for row in rows]

    def list_productos(self) -> list[Producto]:
        with self.engine.connect() as conn:
            rows = conn.execute(select(productos)).mappings().all()
        return [Producto(**row) for row in rows]

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
        return Producto(**row) if row else None

    def get_ramo(self, ramo_id: str) -> Ramo | None:
        with self.engine.connect() as conn:
            row = conn.execute(select(ramos).where(ramos.c.id == ramo_id)).mappings().first()
        return Ramo(**row) if row else None

    def upsert_ramo(self, ramo: Ramo) -> None:
        stmt = pg_insert(ramos).values(**ramo.model_dump())
        stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
        with self.engine.begin() as conn:
            conn.execute(stmt)

    def upsert_producto(self, producto: Producto) -> None:
        stmt = pg_insert(productos).values(**producto.model_dump())
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
