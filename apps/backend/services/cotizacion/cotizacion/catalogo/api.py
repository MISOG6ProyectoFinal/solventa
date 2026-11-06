from fastapi import APIRouter, HTTPException, status

from cotizacion.catalogo.domain.models import Producto, ProductoMobileResponse, Ramo
from cotizacion.container import container

router = APIRouter(prefix="/catalogo", tags=["Catálogo de Productos"])


@router.get("/")
def info() -> dict:
    return {"component": "Catálogo de Productos"}


@router.get("/ramos", response_model=list[Ramo])
def listar_ramos() -> list[Ramo]:
    """Ramos registrados en la base de datos PostgreSQL."""
    return container.catalogo.list_ramos()


@router.get("/productos", response_model=list[ProductoMobileResponse])
def listar_productos() -> list[ProductoMobileResponse]:
    """Productos activos habilitados para compra desde Mobile."""
    return container.listar_productos_mobile.execute()


@router.get("/productos/{producto_id}", response_model=Producto)
def get_product(producto_id: str) -> Producto:
    """Producto con su ramo, para mostrar una póliza emitida en cualquier canal."""
    product = container.catalogo.get_producto(producto_id)
    if product is None:
        detail = {"codigo": "producto_no_encontrado", "mensaje": f"Producto no encontrado: {producto_id}"}
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail)
    return product
