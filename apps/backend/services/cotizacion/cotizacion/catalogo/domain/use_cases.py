from cotizacion.catalogo.domain.models import (
    Canal,
    ChannelLineResponse,
    ChannelProductResponse,
    CoberturaResponse,
    ProductNotInChannel,
    Producto,
    ProductoInactivo,
    ProductoMobileResponse,
    ProductoNoEncontrado,
    Ramo,
    RamoResponse,
)
from cotizacion.catalogo.domain.ports import CatalogoRepository


def lines_in_channel(catalogo: CatalogoRepository, canal: Canal) -> list[tuple[Ramo, list[Producto]]]:
    productos = [p for p in catalogo.list_productos() if p.activo and canal in p.canales]
    ramos = sorted(catalogo.list_ramos(), key=lambda ramo: ramo.orden)
    return [(ramo, del_ramo) for ramo in ramos if (del_ramo := [p for p in productos if p.ramo_id == ramo.id])]


class ListChannelLinesUseCase:
    def __init__(self, catalogo: CatalogoRepository) -> None:
        self.catalogo = catalogo

    def execute(self, canal: Canal) -> list[ChannelLineResponse]:
        return [
            ChannelLineResponse(
                id=ramo.id,
                nombre=ramo.nombre,
                requiere_consentimiento=any(p.requiere_consentimiento for p in productos),
                productos=[
                    ChannelProductResponse(id=p.id, nombre=p.nombre, requiere_consentimiento=p.requiere_consentimiento)
                    for p in productos
                ],
            )
            for ramo, productos in lines_in_channel(self.catalogo, canal)
        ]


class ListarProductosMobileUseCase:
    def __init__(self, catalogo: CatalogoRepository) -> None:
        self.catalogo = catalogo

    def execute(self) -> list[ProductoMobileResponse]:
        presentados = [p for p in self.catalogo.list_productos() if p.activo and p.presentacion_mobile is not None]
        resultado: list[ProductoMobileResponse] = []
        for producto in sorted(presentados, key=lambda p: p.presentacion_mobile.orden):
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
                    descripcion=producto.presentacion_mobile.descripcion,
                    precio_desde=producto.presentacion_mobile.precio_desde,
                    disponible=Canal.MOBILE in producto.canales,
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
    def __init__(self, catalogo: CatalogoRepository) -> None:
        self.validar_producto = ValidarProductoUseCase(catalogo)

    def execute(self, producto_id: str, canal: Canal) -> Producto:
        producto = self.validar_producto.execute(producto_id)
        if canal not in producto.canales:
            raise ProductNotInChannel(producto_id)
        return producto
