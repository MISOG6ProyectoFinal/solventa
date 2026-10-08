from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Aviso(BaseModel):
    id: str
    poliza_id: str
    tipo: str
    ocurrido_en: datetime
    descripcion: str
    ubicacion: str | None = None
    estado: str = "borrador"


class NuevoAviso(BaseModel):
    poliza_id: str
    tipo: str
    ocurrido_en: datetime
    descripcion: str
    ubicacion: str | None = None


class NuevaCarga(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content_type: str
    tamano: int = Field(alias="bytes")


class Evidencia(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    aviso_id: str
    object_key: str
    url: str
    content_type: str
    tamano: int = Field(alias="bytes")
    estado: str


class Carga(BaseModel):
    evidencia_id: str
    upload_url: str
    headers: dict[str, str]
    expires_at: datetime


class EvidenciaLista(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    url: str
    content_type: str
    tamano: int = Field(alias="bytes")
    estado: str
    download_url: str


class ObjetoGuardado(BaseModel):
    content_type: str
    size: int
