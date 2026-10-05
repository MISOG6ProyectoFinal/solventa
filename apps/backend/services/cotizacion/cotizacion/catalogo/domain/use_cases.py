from cotizacion.catalogo.domain.models import (
    CoberturaResponse,
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


class ValidarProductoMobileUseCase:
    """Valida que el producto exista, esté activo y habilitado para Mobile."""

    def __init__(self, catalogo: CatalogoRepository) -> None:
        self.catalogo = catalogo

    def execute(self, producto_id: str):
        producto = self.catalogo.get_producto(producto_id)
        if producto is None:
            raise ProductoNoEncontrado(producto_id)
        if not producto.activo:
            raise ProductoInactivo(producto_id)
        if not producto.disponible_mobile:
            raise ProductoNoDisponibleMobile(producto_id)
        return producto
