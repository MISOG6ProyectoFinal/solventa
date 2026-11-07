"""Error 422 de una cotización con datos faltantes o inválidos, igual en todos los canales."""

from pydantic import ValidationError

INVALID_DATA_CODE = "datos_invalidos"
INVALID_DATA_MESSAGE = "La solicitud tiene datos faltantes o inválidos. No se calculó la prima."

_MESSAGES = {
    "missing": "Campo obligatorio",
    "greater_than": "Debe ser mayor que {gt}",
    "greater_than_equal": "Debe ser mayor o igual que {ge}",
    "less_than_equal": "Debe ser menor o igual que {le}",
    "literal_error": "Valor no permitido. Opciones: {expected}",
    "string_too_short": "No puede estar vacío",
    "string_too_long": "Supera la longitud máxima",
}


def _message(error: dict) -> str:
    kind = error["type"]
    if kind in _MESSAGES:
        return _MESSAGES[kind].format(**error.get("ctx", {}))
    if kind == "value_error":
        return str(error["msg"]).removeprefix("Value error, ")
    if kind.endswith("_parsing") or kind.endswith("_type"):
        return "Formato inválido"
    return "Valor inválido"


def invalid_fields(exc: ValidationError) -> list[dict[str, str]]:
    return [
        {"campo": ".".join(str(part) for part in error["loc"]) or "solicitud", "error": _message(error)}
        for error in exc.errors()
    ]


def invalid_data_detail(fields: list[dict[str, str]]) -> dict:
    return {"codigo": INVALID_DATA_CODE, "mensaje": INVALID_DATA_MESSAGE, "campos": fields}
