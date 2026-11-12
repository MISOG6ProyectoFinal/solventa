"""Ids que viajan en la ruta: solo letras, números, guion y guion bajo, antes de tocar otro servicio."""

from typing import Annotated

from fastapi import Path

ResourceId = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
