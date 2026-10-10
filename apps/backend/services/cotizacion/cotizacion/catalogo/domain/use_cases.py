from cotizacion.catalogo.domain.models import (
    Canal,
    CoberturaResponse,
    Producto,
    ProductoInactivo,
    ProductoMobileResponse,
    ProductoNoDisponibleMobile,
    ProductoNoEncontrado,
    RamoResponse,
)
from cotizacion.catalogo.domain.ports import CatalogoRepository


class ListarProductosMobileUseCase:
    def __init__(self, catalogo: CatalogoRepository) -> None:
        self.catalogo = catalogo

    def execute(self) -> list[ProductoMobileResponse]:
        ramos = {r.id: r for r in self.catalogo.list_ramos()}
        productos = [p for p in self.catalogo.list_productos() if p.activo and p.disponible_mobile]
        resultado: list[ProductoMobileResponse] = []
        for producto in productos:
            ramo = ramos.get(producto.ramo_id)
            if ramo is None:
                continue
            coberturas = [
                CoberturaResponse(id=c.id, nombre=c.nombre) for c in self.catalogo.list_coberturas(producto.id)
            ]
            resultado.append(
                ProductoMobileResponse(
                    id=producto.id,
                    nombre=producto.nombre,
                    ramo=RamoResponse(id=ramo.id, nombre=ramo.nombre),
                    coberturas=coberturas,
                )
            )
        return resultado


class ValidarProductoUseCase:
    """Valida que el producto exista y esté activo, sin asumir un canal."""

    def __init__(self, catalogo: CatalogoRepository) -> None:
        self.catalogo = catalogo

    def execute(self, producto_id: str) -> Producto:
        producto = self.catalogo.get_producto(producto_id)
        if producto is None:
            raise ProductoNoEncontrado(producto_id)
        if not producto.activo:
            raise ProductoInactivo(producto_id)
        return producto


class ValidarProductoParaCanalUseCase:
    """Aplica la validación general y, solo en Mobile, la disponibilidad del canal."""

    def __init__(self, catalogo: CatalogoRepository) -> None:
        self.validar_producto = ValidarProductoUseCase(catalogo)

    def execute(self, producto_id: str, canal: Canal) -> Producto:
        producto = self.validar_producto.execute(producto_id)
        if canal == Canal.MOBILE and not producto.disponible_mobile:
            raise ProductoNoDisponibleMobile(producto_id)
        return producto
