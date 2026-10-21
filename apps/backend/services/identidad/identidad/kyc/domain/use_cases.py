import logging
import random
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from solventa_common.sesion import sign_token

from identidad.kyc.domain.models import (
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
        cliente_id = (solicitud.cliente_id or "").strip()
        if not cliente_id and solicitud.numero_documento:
            cliente_id = f"CLI-{solicitud.numero_documento.strip()}"
        elif not cliente_id:
            cliente_id = f"CLI-{random.randint(10000, 99999)}"

        if self.clients is not None:
            email_val = (
                solicitud.email.strip()
                if solicitud.email
                else (solicitud.contacto if solicitud.canal == "email" else f"{cliente_id.lower()}@solventa.com")
            )
            tel_val = (
                solicitud.telefono.strip()
                if solicitud.telefono
                else (solicitud.contacto if solicitud.canal == "sms" else "")
            )
            cliente_obj = Client(
                id=cliente_id,
                tipo_documento=solicitud.tipo_documento or "CC",
                numero_documento=solicitud.numero_documento or "",
                nombre=solicitud.nombre or "Cliente",
                email=email_val,
                telefono=tel_val,
                fecha_nacimiento=solicitud.fecha_nacimiento,
                pais=solicitud.pais or "Colombia",
            )
            cliente_guardado = self.clients.upsert(cliente_obj)
            cliente_id = cliente_guardado.id

        # 2. Contacto, Máscara y Fuente
        contacto = (solicitud.contacto or "").strip()
        contacto_mask = (solicitud.contacto_mask or "").strip()

        if contacto and (not contacto_mask or contacto_mask == "***4567"):
            if solicitud.canal.lower() == "sms":
                digits = "".join(filter(str.isdigit, contacto))
                contacto_mask = f"***{digits[-4:]}" if len(digits) >= 4 else contacto
            else:
                if "@" in contacto:
                    u, d = contacto.split("@", 1)
                    v = u[:2] if len(u) > 2 else u[:1]
                    contacto_mask = f"{v}***@{d}"
                else:
                    contacto_mask = contacto
        elif not contacto and contacto_mask:
            contacto = contacto_mask

        canal_txt = "SMS" if solicitud.canal.lower() == "sms" else "Correo"
        fuente = f"{canal_txt}: {contacto or contacto_mask}"

        # 3. Alcance (List[String])
        alcance = list(solicitud.alcance) if solicitud.alcance else []
        if not alcance:
            if solicitud.open_finance:
                alcance.append("Open Finance")
            if solicitud.open_data:
                alcance.append("Open Data")

        consentimiento_id = f"CNS-{random.randint(10000, 99999)}"
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
            contacto_mask=contacto_mask or contacto or "***4567",
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

        return RespuestaConsulta(
            consentimiento_id=consentimiento.id,
            cliente_id=consentimiento.cliente_id,
            cliente_nombre=cliente_nombre,
            cliente_documento=cliente_doc,
            estado="Otorgado" if consentimiento.estado == "OTORGADO" else consentimiento.estado.capitalize(),
            fuente=consentimiento.fuente,
            fecha_otorgamiento=consentimiento.fecha_otorgamiento.isoformat() if consentimiento.fecha_otorgamiento else None,
            fecha_revocacion=consentimiento.fecha_revocacion.isoformat() if consentimiento.fecha_revocacion else None,
            fecha_hora=fecha_hora_str,
            asesor=consentimiento.asesor,
            canal=canal_label,
            contacto=consentimiento.contacto or consentimiento.contacto_mask,
            alcance=alcance_str,
            alcance_lista=consentimiento.alcance,
        )
