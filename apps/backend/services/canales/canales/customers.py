from solventa_common.integration import ServiceClient
from solventa_common.integration.base import call_upstream


def ensure_customer(identity: ServiceClient, customer: dict) -> str | None:
    birth_date = customer.get("fecha_nacimiento")
    ensured = call_upstream(
        identity.post,
        "/identidad/clientes/asegurar",
        json={
            "tipo_documento": customer["tipo_documento"],
            "numero_documento": customer["numero_documento"],
            "nombre": customer.get("nombre", ""),
            "apellido": customer.get("apellido", ""),
            "email": customer.get("email", ""),
            "telefono": customer.get("telefono", ""),
            "fecha_nacimiento": str(birth_date) if birth_date else None,
        },
    )
    return ensured.get("id") if ensured else None
