from fastapi import APIRouter

from cotizacion.catalogo.domain.models import ProductoMobileResponse
from cotizacion.container import container

router = APIRouter(prefix="/catalogo", tags=["Catálogo de Productos"])


@router.get("/")
def info() -> dict:
    return {"component": "Catálogo de Productos"}


@router.get("/productos", response_model=list[ProductoMobileResponse])
def listar_productos() -> list[ProductoMobileResponse]:
    """Productos activos habilitados para compra desde Mobile."""
    return container.listar_productos_mobile.execute()
