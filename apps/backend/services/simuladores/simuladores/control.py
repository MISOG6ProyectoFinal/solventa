"""Modo de cada tercero simulado y las llamadas que recibió en cada modo."""

import asyncio
from collections import Counter
from dataclasses import dataclass, field
from enum import StrEnum

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from solventa_common.errors import error_detail

from simuladores.config import settings


class Mode(StrEnum):
    NORMAL = "normal"
    SLOW = "lento"
    DOWN = "caido"
    INVALID = "invalida"


@dataclass
class Provider:
    name: str
    description: str
    mode: Mode = Mode.NORMAL
    delay_s: float = settings.demora_lento_s
    calls: Counter[str] = field(default_factory=Counter)

    async def respond(self) -> Mode:
        """Registra la llamada y aplica el modo. El llamador decide qué devuelve en normal e invalida."""
        mode = self.mode
        self.calls[mode] += 1
        if mode == Mode.DOWN:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"{self.name} no disponible (simulado)")
        if mode == Mode.SLOW:
            await asyncio.sleep(self.delay_s)
        return mode

    def view(self) -> dict:
        return {
            "proveedor": self.name,
            "descripcion": self.description,
            "modo": self.mode,
            "demora_s": self.delay_s,
            "llamadas": dict(self.calls),
        }


PROVIDERS: dict[str, Provider] = {
    provider.name: provider
    for provider in (
        Provider("open-finance", "Perfil financiero y score de riesgo"),
        Provider("pasarela-pagos", "Cobros con clave de idempotencia"),
        Provider("notificaciones", "SMS y correo"),
        Provider("red-asistencia", "Despacho de grúa, ambulancia y perito"),
    )
}


class ModeChange(BaseModel):
    modo: Mode
    demora_s: float | None = Field(default=None, gt=0, le=30)


router = APIRouter(prefix="/simuladores", tags=["Control de simuladores"])


def _provider(name: str) -> Provider:
    provider = PROVIDERS.get(name)
    if provider is None:
        detail = error_detail("proveedor_no_encontrado", f"No hay simulador para '{name}'.")
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail)
    return provider


@router.get("")
def list_providers() -> list[dict]:
    return [provider.view() for provider in PROVIDERS.values()]


@router.get("/{proveedor}")
def get_provider(proveedor: str) -> dict:
    return _provider(proveedor).view()


@router.put("/{proveedor}/modo")
def change_mode(proveedor: str, cambio: ModeChange) -> dict:
    """normal responde bien, lento responde después de demora_s, caido responde 503 e invalida responde un
    cuerpo que el adaptador no reconoce."""
    provider = _provider(proveedor)
    provider.mode = cambio.modo
    if cambio.demora_s is not None:
        provider.delay_s = cambio.demora_s
    return provider.view()


@router.delete("/{proveedor}/llamadas", status_code=status.HTTP_204_NO_CONTENT)
def reset_calls(proveedor: str) -> None:
    _provider(proveedor).calls.clear()
