from fastapi import APIRouter, HTTPException, status

from cotizacion.catalogo.domain.models import Canal, ChannelLineResponse, Producto, ProductoMobileResponse, Ramo
from cotizacion.consenso.domain.quote_contract import published_contract
from cotizacion.container import container

router = APIRouter(prefix="/catalogo", tags=["Catálogo de Productos"])


@router.get("/")
def info() -> dict:
    return {"component": "Catálogo de Productos"}


@router.get("/ramos", response_model=list[Ramo])
def listar_ramos() -> list[Ramo]:
    """Ramos registrados en la base de datos PostgreSQL."""
    return container.catalogo.list_ramos()


@router.get("/canales/{canal}/ramos", response_model=list[ChannelLineResponse])
def listar_lines_in_channel(canal: Canal) -> list[ChannelLineResponse]:
    """Ramos con sus productos activos en el canal, y cuáles exigen consentimiento Open Finance."""
    return container.listar_lines_in_channel.execute(canal)


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


@router.get("/productos/{producto_id}/contrato")
def get_contract(producto_id: str) -> dict:
    """JSON Schema del cuerpo con que se cotiza el producto, con las opciones que acepta cada campo."""
    contract = published_contract(producto_id, container.rules.current())
    if contract is None:
        detail = {
            "codigo": "producto_sin_contrato",
            "mensaje": f"El producto no tiene contrato de cotización: {producto_id}",
        }
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail)
    return contract
