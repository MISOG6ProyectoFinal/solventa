from cotizacion.catalogo.domain.catalogo_mobile import CATALOGO_MOBILE, PRODUCTOS_CATALOGO_MOBILE
from cotizacion.catalogo.domain.models import (
    Canal,
    CoberturaResponse,
    Producto,
    ProductoFueraCatalogoMobile,
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
        resultado: list[ProductoMobileResponse] = []
        for entrada in sorted(CATALOGO_MOBILE, key=lambda e: e.orden):
            producto = self.catalogo.get_producto(entrada.producto_id)
            if producto is None or not producto.activo:
                continue
            ramo = self.catalogo.get_ramo(producto.ramo_id)
            if ramo is None:
                continue
            coberturas = [
                CoberturaResponse(id=c.id, nombre=c.nombre) for c in self.catalogo.list_coberturas(producto.id)
            ]
            resultado.append(
                ProductoMobileResponse(
                    id=producto.id,
                    nombre=producto.nombre,
                    descripcion=entrada.descripcion,
                    precio_desde=entrada.precio_desde,
                    disponible=producto.disponible_mobile,
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
    """Aplica la validación general y, solo en Mobile, las reglas del canal.

    En Mobile el producto debe pertenecer al catálogo Mobile (aparecer) y
    tener disponible_mobile (poder cotizarse).
    """

    def __init__(self, catalogo: CatalogoRepository) -> None:
        self.validar_producto = ValidarProductoUseCase(catalogo)

    def execute(self, producto_id: str, canal: Canal) -> Producto:
        producto = self.validar_producto.execute(producto_id)
        if canal == Canal.MOBILE:
            if producto.id not in PRODUCTOS_CATALOGO_MOBILE:
                raise ProductoFueraCatalogoMobile(producto_id)
            if not producto.disponible_mobile:
                raise ProductoNoDisponibleMobile(producto_id)
        return producto
