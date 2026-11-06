"""Consulta de pólizas del back-office: la póliza de Pólizas con el asegurado, el socio, el producto,
los cobros y los siniestros que guardan los demás servicios."""

from collections.abc import Callable
from urllib.parse import quote

import httpx
from solventa_common.integration.base import call_upstream
from solventa_common.resilience import CircuitOpenError

from canales.clients import cotizacion, identidad, pagos, polizas, siniestros

RECENT_LIMIT = 100
CUSTOMER_FIELDS = ("tipo_documento", "numero_documento", "nombre", "apellido", "email", "telefono")


def _optional(read: Callable[[str], dict | list], path: str) -> dict | list | None:
    """Un dato que falta en otro servicio no impide mostrar la póliza."""
    try:
        return read(path)
    except (httpx.HTTPError, CircuitOpenError):
        return None


def _lookup(read: Callable[[str], dict | list], template: str, ids: set[str]) -> dict[str, dict]:
    found = {resource_id: _optional(read, template.format(resource_id)) for resource_id in ids}
    return {resource_id: value for resource_id, value in found.items() if isinstance(value, dict)}


def _summaries(raw: list[dict]) -> list[dict]:
    customers = _lookup(identidad.get, "/identidad/clientes/{}", {p["cliente_id"] for p in raw if p.get("cliente_id")})
    partners = _lookup(cotizacion.get, "/gobierno-socios/socios/{}", {p["socio_id"] for p in raw if p.get("socio_id")})
    products = _lookup(cotizacion.get, "/catalogo/productos/{}", {p["producto_id"] for p in raw})
    views = []
    for policy in raw:
        customer = customers.get(policy.get("cliente_id") or "")
        partner = partners.get(policy.get("socio_id") or "")
        product = products.get(policy["producto_id"])
        views.append(
            {
                **policy,
                "cliente": {key: customer.get(key, "") for key in CUSTOMER_FIELDS} if customer else None,
                "socio": {"id": partner["id"], "nombre": partner["nombre"]} if partner else None,
                "producto": {"id": product["id"], "nombre": product["nombre"]} if product else None,
                "ramo_id": product["ramo_id"] if product else None,
            }
        )
    return views


def recent_policies() -> list[dict]:
    return _summaries(call_upstream(polizas.get, "/polizas/recientes", params={"limite": RECENT_LIMIT}))


def policy_detail(poliza_id: str) -> dict:
    policy_id = quote(poliza_id, safe="")
    [view] = _summaries([call_upstream(polizas.get, f"/polizas/{policy_id}")])
    payment = _optional(pagos.get, f"/pagos/cobros/{quote(view['cobro_id'], safe='')}")
    claims = _optional(siniestros.get, f"/siniestros/polizas/{policy_id}/avisos")
    return {**view, "pagos": [payment] if isinstance(payment, dict) else [], "siniestros": claims or []}
