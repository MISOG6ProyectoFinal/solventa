from datetime import date, datetime

from pydantic import BaseModel, model_validator

TIPOS_DOCUMENTO = ("CC", "CE", "Pasaporte")
MIN_PASSWORD_LENGTH = 8


class Client(BaseModel):
    id: str
    email: str
    nombre: str = ""
    first_name: str = ""
    last_name: str = ""
    tipo_documento: str = "CC"
    numero_documento: str = ""
    fecha_nacimiento: date | str | None = None
    telefono: str = ""

    @model_validator(mode="after")
    def _sync_names(self) -> "Client":
        if not self.nombre and (self.first_name or self.last_name):
            self.nombre = f"{self.first_name} {self.last_name}".strip()
        elif self.nombre and not self.first_name:
            parts = self.nombre.split(" ", 1)
            self.first_name = parts[0]
            self.last_name = parts[1] if len(parts) > 1 else ""
        return self


class Account(BaseModel):
    client_id: str
    password_hash: str
    salt: str


class Session(BaseModel):
    token: str
    client_id: str


class InvalidCredentials(Exception):
    pass


class EmailAlreadyRegistered(Exception):
    pass


class DocumentAlreadyRegistered(Exception):
    pass


# --- HU002: Consentimiento Digital Open Finance / Open Data ---

OPEN_FINANCE = "Open Finance"
OPEN_DATA = "Open Data"
DEFAULT_ALCANCE = [OPEN_FINANCE, OPEN_DATA]


class Consentimiento(BaseModel):
    id: str
    cliente_id: str
    alcance: list[str] = [OPEN_FINANCE, OPEN_DATA]
    fuente: str = ""
    estado: str  # PENDIENTE, OTORGADO, REVOCADO, EXPIRADO
    fecha_otorgamiento: datetime | None = None
    fecha_revocacion: datetime | None = None

    # Trazabilidad / Auditoría OTP
    codigo_hash: str
    codigo_demo: str
    asesor: str
    solicitado_en: datetime
    expira_en: datetime

    # Compatibilidad y auxiliares
    ramo: str = "VIDA_HIPOTECARIO"
    canal: str = "sms"
    contacto: str = ""
    contacto_mask: str = ""
    open_finance: bool = True
    open_data: bool = True
    validado_en: datetime | None = None


class SolicitudConsentimiento(BaseModel):
    cliente_id: str | None = None
    tipo_documento: str = "CC"
    numero_documento: str = ""
    nombre: str = ""
    email: str = ""
    telefono: str = ""
    fecha_nacimiento: str | None = None
    ramo: str = "VIDA_HIPOTECARIO"
    canal: str = "sms"
    contacto: str = ""
    contacto_mask: str = ""
    alcance: list[str] = [OPEN_FINANCE, OPEN_DATA]
    open_finance: bool = True
    open_data: bool = True
    asesor: str = "Ana Gómez (asesor)"


class RespuestaSolicitud(BaseModel):
    consentimiento_id: str
    cliente_id: str
    estado: str
    alcance: list[str] = [OPEN_FINANCE, OPEN_DATA]
    fuente: str = ""
    contacto: str = ""
    contacto_mask: str = ""
    codigo_demo: str
    expira_en: str


class RespuestaValidacion(BaseModel):
    consentimiento_id: str
    cliente_id: str
    estado: str
    fuente: str = ""
    fecha_otorgamiento: str | None = None
    validado_en: str
    asesor: str
    canal: str
    alcance: list[str] = [OPEN_FINANCE, OPEN_DATA]
    open_finance: bool
    open_data: bool


class RespuestaConsulta(BaseModel):
    consentimiento_id: str
    cliente_id: str
    cliente_nombre: str = ""
    cliente_documento: str = ""
    estado: str
    fuente: str = ""
    fecha_otorgamiento: str | None = None
    fecha_revocacion: str | None = None
    fecha_hora: str
    asesor: str
    canal: str
    contacto: str = ""
    alcance: str
    alcance_lista: list[str] = [OPEN_FINANCE, OPEN_DATA]


class ConsentimientoNoEncontrado(Exception):
    pass


class CodigoOtpInvalido(Exception):
    pass


class ConsentimientoExpirado(Exception):
    pass
