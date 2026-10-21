import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from solventa_common.sesion import sign_token

from identidad.kyc.domain.models import (
    OPEN_DATA,
    OPEN_FINANCE,
    Client,
    CodigoOtpInvalido,
    Consentimiento,
    ConsentimientoExpirado,
    ConsentimientoNoEncontrado,
    EmailAlreadyRegistered,
    InvalidCredentials,
    RespuestaConsulta,
    RespuestaSolicitud,
    RespuestaValidacion,
    Session,
    SolicitudConsentimiento,
)
from identidad.kyc.domain.otp import generar_codigo, hash_codigo, verificar_codigo
from identidad.kyc.domain.ports import ClientRepository, ConsentimientoRepository
from identidad.kyc.domain.sesion import hash_password, new_salt, password_matches

logger = logging.getLogger(__name__)

SESSION_DAYS = 7
_DUMMY_SALT = "00" * 16
_DUMMY_HASH = hash_password("not-a-client-password", _DUMMY_SALT)


def issue_session(client: Client, secret: str) -> Session:
    expires_at = datetime.now(UTC) + timedelta(days=SESSION_DAYS)
    token = sign_token(
        client.id,
        client.email,
        secret,
        first_name=client.first_name,
        last_name=client.last_name,
        expires_at=expires_at,
    )
    return Session(token=token, client_id=client.id)


class StartSession:
    def __init__(self, clients: ClientRepository, secret: str) -> None:
        self.clients = clients
        self.secret = secret

    def execute(self, email: str, password: str) -> Session:
        client = self.clients.get_by_email(email.lower())
        # A missing account still runs the slow check, so the response time does not reveal which case it was.
        if client is None:
            password_matches(password, _DUMMY_HASH, _DUMMY_SALT)
            raise InvalidCredentials
        if not password_matches(password, client.password_hash, client.salt):
            raise InvalidCredentials
        return issue_session(client, self.secret)


class RegisterClient:
    def __init__(self, clients: ClientRepository, secret: str) -> None:
        self.clients = clients
        self.secret = secret

    def execute(self, email: str, password: str, first_name: str, last_name: str) -> Session:
        normalized = email.lower()
        if self.clients.get_by_email(normalized) is not None:
            raise EmailAlreadyRegistered
        salt = new_salt()
        client = Client(
            id=str(uuid4()),
            email=normalized,
            first_name=first_name,
            last_name=last_name,
            password_hash=hash_password(password, salt),
            salt=salt,
        )
        self.clients.add(client)
        return issue_session(client, self.secret)


# --- HU002: Casos de uso de Consentimiento Digital ---


def _generate_random_id(prefix: str) -> str:
    n = secrets.randbelow(90000) + 10000
    return f"{prefix}-{n}"


def _resolve_cliente_id(solicitud: SolicitudConsentimiento) -> str:
    cid = (solicitud.cliente_id or "").strip()
    if cid:
        return cid
    if solicitud.numero_documento:
        return f"CLI-{solicitud.numero_documento.strip()}"
    return _generate_random_id("CLI")


def _resolve_cliente_email(solicitud: SolicitudConsentimiento, cliente_id: str) -> str:
    if solicitud.email and solicitud.email.strip():
        return solicitud.email.strip()
    if solicitud.canal == "email" and solicitud.contacto:
        return solicitud.contacto.strip()
    return f"{cliente_id.lower()}@solventa.com"


def _resolve_cliente_telefono(solicitud: SolicitudConsentimiento) -> str:
    if solicitud.telefono and solicitud.telefono.strip():
        return solicitud.telefono.strip()
    if solicitud.canal == "sms" and solicitud.contacto:
        return solicitud.contacto.strip()
    return ""


def _mask_contacto(canal: str, contacto: str) -> str:
    if canal == "sms":
        digits = "".join(filter(str.isdigit, contacto))
        return f"***{digits[-4:]}" if len(digits) >= 4 else contacto
    if "@" in contacto:
        u, d = contacto.split("@", 1)
        v = u[:2] if len(u) > 2 else u[:1]
        return f"{v}***@{d}"
    return contacto


def _resolve_contacto_y_mascara(solicitud: SolicitudConsentimiento) -> tuple[str, str]:
    contacto = (solicitud.contacto or "").strip()
    contacto_mask = (solicitud.contacto_mask or "").strip()

    if contacto and (not contacto_mask or contacto_mask == "***4567"):
        contacto_mask = _mask_contacto(solicitud.canal.lower(), contacto)
    elif not contacto and contacto_mask:
        contacto = contacto_mask
    elif not contacto and not contacto_mask:
        contacto_mask = "***4567"

    return contacto, contacto_mask


def _resolve_solicitud_alcance(solicitud: SolicitudConsentimiento) -> list[str]:
    if solicitud.alcance:
        return list(solicitud.alcance)
    alcance = []
    if solicitud.open_finance:
        alcance.append(OPEN_FINANCE)
    if solicitud.open_data:
        alcance.append(OPEN_DATA)
    return alcance or [OPEN_FINANCE, OPEN_DATA]


class SolicitarConsentimiento:
    def __init__(
        self,
        repository: ConsentimientoRepository,
        clients: ClientRepository | None = None,
    ) -> None:
        self.repository = repository
        self.clients = clients

    def execute(self, solicitud: SolicitudConsentimiento) -> RespuestaSolicitud:
        ahora = datetime.now(UTC)
        expira_en = ahora + timedelta(minutes=5)

        # 1. Identificar o Registrar el Cliente según el Modelo de Dominio
        cliente_id = _resolve_cliente_id(solicitud)

        if self.clients is not None:
            cliente_obj = Client(
                id=cliente_id,
                tipo_documento=solicitud.tipo_documento or "CC",
                numero_documento=solicitud.numero_documento or "",
                nombre=solicitud.nombre or "Cliente",
                email=_resolve_cliente_email(solicitud, cliente_id),
                telefono=_resolve_cliente_telefono(solicitud),
                fecha_nacimiento=solicitud.fecha_nacimiento,
                pais=solicitud.pais or "Colombia",
            )
            cliente_guardado = self.clients.upsert(cliente_obj)
            cliente_id = cliente_guardado.id

        # 2. Contacto, Máscara y Fuente
        contacto, contacto_mask = _resolve_contacto_y_mascara(solicitud)
        canal_txt = "SMS" if solicitud.canal.lower() == "sms" else "Correo"
        fuente = f"{canal_txt}: {contacto or contacto_mask}"

        # 3. Alcance (List[String])
        alcance = _resolve_solicitud_alcance(solicitud)

        consentimiento_id = _generate_random_id("CNS")
        codigo = generar_codigo()
        codigo_sha = hash_codigo(codigo)

        consentimiento = Consentimiento(
            id=consentimiento_id,
            cliente_id=cliente_id,
            alcance=alcance,
            fuente=fuente,
            estado="PENDIENTE",
            fecha_otorgamiento=None,
            fecha_revocacion=None,
            ramo=solicitud.ramo,
            canal=solicitud.canal,
            contacto=contacto,
            contacto_mask=contacto_mask,
            open_finance=solicitud.open_finance,
            open_data=solicitud.open_data,
            codigo_hash=codigo_sha,
            codigo_demo=codigo,
            asesor=solicitud.asesor,
            solicitado_en=ahora,
            expira_en=expira_en,
        )
        self.repository.add(consentimiento)

        logger.info(
            "📲 [MOCK OTP] Cliente: %s | Canal: %s | Fuente: %s | Código OTP: %s | Vence: %s",
            cliente_id,
            consentimiento.canal,
            consentimiento.fuente,
            codigo,
            expira_en.isoformat(),
        )

        return RespuestaSolicitud(
            consentimiento_id=consentimiento.id,
            cliente_id=cliente_id,
            estado=consentimiento.estado,
            alcance=consentimiento.alcance,
            fuente=consentimiento.fuente,
            contacto=consentimiento.contacto,
            contacto_mask=consentimiento.contacto_mask,
            codigo_demo=codigo,
            expira_en=expira_en.isoformat(),
        )


class ValidarConsentimiento:
    def __init__(self, repository: ConsentimientoRepository) -> None:
        self.repository = repository

    def execute(self, consentimiento_id: str, codigo: str) -> RespuestaValidacion:
        consentimiento = self.repository.get(consentimiento_id)
        if consentimiento is None:
            raise ConsentimientoNoEncontrado(f"Consentimiento {consentimiento_id} no encontrado")

        ahora = datetime.now(UTC)
        expira = consentimiento.expira_en
        if expira.tzinfo is None:
            expira = expira.replace(tzinfo=UTC)

        if ahora > expira:
            consentimiento.estado = "EXPIRADO"
            self.repository.update(consentimiento)
            raise ConsentimientoExpirado("El código OTP ha expirado. Solicite uno nuevo.")

        if not verificar_codigo(codigo, consentimiento.codigo_hash):
            raise CodigoOtpInvalido("Código OTP incorrecto. Vuelva a intentarlo.")

        consentimiento.estado = "OTORGADO"
        consentimiento.fecha_otorgamiento = ahora
        consentimiento.validado_en = ahora
        self.repository.update(consentimiento)

        return RespuestaValidacion(
            consentimiento_id=consentimiento.id,
            cliente_id=consentimiento.cliente_id,
            estado=consentimiento.estado,
            fuente=consentimiento.fuente,
            fecha_otorgamiento=ahora.isoformat(),
            validado_en=ahora.isoformat(),
            asesor=consentimiento.asesor,
            canal=consentimiento.canal,
            alcance=consentimiento.alcance,
            open_finance=consentimiento.open_finance,
            open_data=consentimiento.open_data,
        )


class ConsultarConsentimiento:
    def __init__(
        self,
        repository: ConsentimientoRepository,
        clients: ClientRepository | None = None,
    ) -> None:
        self.repository = repository
        self.clients = clients

    def execute(self, consentimiento_id: str) -> RespuestaConsulta:
        consentimiento = self.repository.get(consentimiento_id)
        if consentimiento is None:
            raise ConsentimientoNoEncontrado(f"Consentimiento {consentimiento_id} no encontrado")

        cliente_nombre = ""
        cliente_doc = ""
        if self.clients:
            cliente = self.clients.get(consentimiento.cliente_id)
            if cliente:
                cliente_nombre = cliente.nombre
                cliente_doc = f"{cliente.tipo_documento} {cliente.numero_documento}".strip()

        fecha_ref = consentimiento.fecha_otorgamiento or consentimiento.validado_en or consentimiento.solicitado_en
        fecha_hora_str = fecha_ref.strftime("%Y-%m-%d %H:%M")

        canal_label = "Código por SMS" if consentimiento.canal.lower() == "sms" else "Código por correo electrónico"
        alcance_str = ", ".join(consentimiento.alcance) if consentimiento.alcance else "Open Finance, Open Data"

        fecha_otorgamiento_iso = (
            consentimiento.fecha_otorgamiento.isoformat() if consentimiento.fecha_otorgamiento else None
        )
        fecha_revocacion_iso = consentimiento.fecha_revocacion.isoformat() if consentimiento.fecha_revocacion else None

        return RespuestaConsulta(
            consentimiento_id=consentimiento.id,
            cliente_id=consentimiento.cliente_id,
            cliente_nombre=cliente_nombre,
            cliente_documento=cliente_doc,
            estado="Otorgado" if consentimiento.estado == "OTORGADO" else consentimiento.estado.capitalize(),
            fuente=consentimiento.fuente,
            fecha_otorgamiento=fecha_otorgamiento_iso,
            fecha_revocacion=fecha_revocacion_iso,
            fecha_hora=fecha_hora_str,
            asesor=consentimiento.asesor,
            canal=canal_label,
            contacto=consentimiento.contacto or consentimiento.contacto_mask,
            alcance=alcance_str,
            alcance_lista=consentimiento.alcance,
        )
