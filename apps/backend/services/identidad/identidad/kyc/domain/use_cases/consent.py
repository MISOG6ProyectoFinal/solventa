"""Consentimiento digital Open Finance / Open Data con OTP."""

from datetime import UTC, datetime

from identidad.kyc.domain.models import (
    DEFAULT_ALCANCE,
    DEFAULT_TIPO_DOCUMENTO,
    OPEN_DATA,
    OPEN_FINANCE,
    OTP_TTL,
    CanalOtp,
    Client,
    CodigoOtpInvalido,
    Consentimiento,
    ConsentimientoExpirado,
    ConsentimientoNoEncontrado,
    EmailAlreadyRegistered,
    EstadoConsentimiento,
    RespuestaConsulta,
    RespuestaSolicitud,
    RespuestaValidacion,
    SolicitudConsentimiento,
)
from identidad.kyc.domain.otp import generar_codigo, hash_codigo, verificar_codigo
from identidad.kyc.domain.ports import ClientRepository, ConsentimientoRepository, OtpSender
from identidad.kyc.domain.use_cases.clients import _generate_random_id, id_cliente


def _resolve_cliente_id(solicitud: SolicitudConsentimiento) -> str:
    # Con documento el id lo calcula el servidor; el cliente_id enviado solo se respeta sin documento.
    if solicitud.numero_documento.strip():
        return id_cliente(solicitud.tipo_documento or DEFAULT_TIPO_DOCUMENTO, solicitud.numero_documento)
    cid = (solicitud.cliente_id or "").strip()
    if cid:
        return cid
    return _generate_random_id("CLI")


def _resolve_cliente_email(solicitud: SolicitudConsentimiento) -> str | None:
    if solicitud.email and solicitud.email.strip():
        return solicitud.email.strip()
    if solicitud.canal == CanalOtp.EMAIL and solicitud.contacto:
        return solicitud.contacto.strip()
    return None


def _resolve_cliente_telefono(solicitud: SolicitudConsentimiento) -> str:
    if solicitud.telefono and solicitud.telefono.strip():
        return solicitud.telefono.strip()
    if solicitud.canal == CanalOtp.SMS and solicitud.contacto:
        return solicitud.contacto.strip()
    return ""


def _mask_contacto(canal: str, contacto: str) -> str:
    if canal == CanalOtp.SMS:
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

    if contacto:
        contacto_mask = _mask_contacto(solicitud.canal.lower(), contacto)
    elif contacto_mask:
        contacto = contacto_mask

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
        otp_sender: OtpSender,
        clients: ClientRepository | None = None,
    ) -> None:
        self.repository = repository
        self.otp_sender = otp_sender
        self.clients = clients

    def execute(self, solicitud: SolicitudConsentimiento) -> RespuestaSolicitud:
        ahora = datetime.now(UTC)
        expira_en = ahora + OTP_TTL

        # 1. Identificar o Registrar el Cliente según el Modelo de Dominio
        cliente_id = _resolve_cliente_id(solicitud)

        # Sin email real no se guarda el cliente: el id es determinista y `asegurar` lo creará después.
        email = _resolve_cliente_email(solicitud)
        if self.clients is not None and email:
            cliente_obj = Client(
                id=cliente_id,
                tipo_documento=solicitud.tipo_documento or DEFAULT_TIPO_DOCUMENTO,
                numero_documento=solicitud.numero_documento or "",
                nombre=solicitud.nombre or "Cliente",
                last_name=solicitud.apellido or "",
                email=email,
                telefono=_resolve_cliente_telefono(solicitud),
                fecha_nacimiento=solicitud.fecha_nacimiento,
            )
            try:
                cliente_guardado = self.clients.upsert(cliente_obj)
            except ValueError as exc:
                raise EmailAlreadyRegistered from exc
            cliente_id = cliente_guardado.id

        # 2. Contacto, Máscara y Fuente
        contacto, contacto_mask = _resolve_contacto_y_mascara(solicitud)
        canal_txt = "SMS" if solicitud.canal.lower() == CanalOtp.SMS else "Correo"
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
            estado=EstadoConsentimiento.PENDING,
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
        self.otp_sender.send(consentimiento.canal, contacto or contacto_mask, codigo, expira_en)
        self.repository.add(consentimiento)

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
            consentimiento.estado = EstadoConsentimiento.EXPIRED
            self.repository.update(consentimiento)
            raise ConsentimientoExpirado("El código OTP ha expirado. Solicite uno nuevo.")

        if not verificar_codigo(codigo, consentimiento.codigo_hash):
            raise CodigoOtpInvalido("Código OTP incorrecto. Vuelva a intentarlo.")

        consentimiento.estado = EstadoConsentimiento.GRANTED
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

        canal_label = (
            "Código por SMS" if consentimiento.canal.lower() == CanalOtp.SMS else "Código por correo electrónico"
        )
        alcance_str = ", ".join(consentimiento.alcance or DEFAULT_ALCANCE)

        fecha_otorgamiento_iso = (
            consentimiento.fecha_otorgamiento.isoformat() if consentimiento.fecha_otorgamiento else None
        )
        fecha_revocacion_iso = consentimiento.fecha_revocacion.isoformat() if consentimiento.fecha_revocacion else None

        return RespuestaConsulta(
            consentimiento_id=consentimiento.id,
            cliente_id=consentimiento.cliente_id,
            cliente_nombre=cliente_nombre,
            cliente_documento=cliente_doc,
            estado="Otorgado"
            if consentimiento.estado == EstadoConsentimiento.GRANTED
            else consentimiento.estado.capitalize(),
            fuente=consentimiento.fuente,
            fecha_otorgamiento=fecha_otorgamiento_iso,
            fecha_revocacion=fecha_revocacion_iso,
            fecha_hora=fecha_hora_str,
            asesor=consentimiento.asesor,
            canal=canal_label,
            contacto=consentimiento.contacto or consentimiento.contacto_mask,
            alcance=alcance_str,
            alcance_lista=consentimiento.alcance,
            open_finance=OPEN_FINANCE in consentimiento.alcance,
        )
