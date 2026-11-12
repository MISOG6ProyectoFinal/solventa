"""Lecturas de catálogo que el portal y el teléfono piden igual; cada BFF decide quién puede llamarlas."""

from urllib.parse import quote

from solventa_common.integration.base import call_upstream

from canales.clients import cotizacion, identidad


def product_contract(producto_id: str) -> dict:
    return call_upstream(cotizacion.get, f"/catalogo/productos/{quote(producto_id, safe='')}/contrato")


def document_types() -> list:
    return call_upstream(identidad.get, "/identidad/tipos-documento")
