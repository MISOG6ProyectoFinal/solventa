"""Controles de prototipo para demostrar HU031.

No son la fuente de verdad de la vigencia ni una pasarela productiva.
El alias demo-4242 no es un PAN: la app solo muestra la terminación 4242.
"""

TOKEN_DEMO = "demo-4242"
TOKEN_RECHAZO_DEMO = "demo-rechazo"


def forzar_cotizacion_vencida(simulacion: str | None) -> bool:
    return simulacion == "vencida"


def token_prototipo(simulacion: str | None) -> str:
    if simulacion == "rechazado":
        return TOKEN_RECHAZO_DEMO
    return TOKEN_DEMO
