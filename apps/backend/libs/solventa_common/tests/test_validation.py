from datetime import date
from typing import Literal

import pytest
from pydantic import BaseModel, Field, ValidationError, field_validator
from solventa_common.validation import invalid_data_detail, invalid_fields


class _Form(BaseModel):
    destino: Literal["España", "México"]
    viajeros: int = Field(ge=1)
    salida: date
    nombre: str = Field(min_length=1, max_length=5)

    @field_validator("nombre")
    @classmethod
    def _sin_digitos(cls, value: str) -> str:
        if any(char.isdigit() for char in value):
            raise ValueError("El nombre no lleva dígitos")
        return value


def _fields(data: dict) -> dict[str, str]:
    with pytest.raises(ValidationError) as exc:
        _Form.model_validate(data)
    return {field["campo"]: field["error"] for field in invalid_fields(exc.value)}


def test_each_field_gets_a_readable_reason():
    fields = _fields({"destino": "Francia", "viajeros": 0, "salida": "ayer", "nombre": ""})

    assert fields == {
        "destino": "Valor no permitido. Opciones: 'España' or 'México'",
        "viajeros": "Debe ser mayor o igual que 1",
        "salida": "Formato inválido",
        "nombre": "No puede estar vacío",
    }


def test_missing_long_and_custom_errors():
    assert _fields({"viajeros": 1, "salida": "2026-12-01", "nombre": "Ana123"}) == {
        "destino": "Campo obligatorio",
        "nombre": "Supera la longitud máxima",
    }
    assert _fields({"destino": "España", "viajeros": 1, "salida": "2026-12-01", "nombre": "Ana1"}) == {
        "nombre": "El nombre no lleva dígitos",
    }


def test_detail_has_the_same_shape_for_every_channel():
    detail = invalid_data_detail([{"campo": "destino", "error": "Campo obligatorio"}])

    assert detail == {
        "codigo": "datos_invalidos",
        "mensaje": "La solicitud tiene datos faltantes o inválidos. No se calculó la prima.",
        "campos": [{"campo": "destino", "error": "Campo obligatorio"}],
    }
