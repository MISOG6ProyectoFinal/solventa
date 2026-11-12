"""Clientes: alta idempotente, consulta por id, documento o lote."""

import secrets

from identidad.kyc.domain.models import (
    Client,
    ClienteNoEncontrado,
    RespuestaCliente,
    SolicitudAsegurarCliente,
)
from identidad.kyc.domain.ports import ClientRepository


def _generate_random_id(prefix: str) -> str:
    n = secrets.randbelow(90000) + 10000
    return f"{prefix}-{n}"


def id_cliente(tipo_documento: str, numero_documento: str) -> str:
    return f"CLI-{tipo_documento.strip().upper()}-{numero_documento.strip()}"


def _cliente_a_respuesta(cliente: Client) -> RespuestaCliente:
    fecha_nac = None
    if cliente.fecha_nacimiento:
        fecha_nac = (
            cliente.fecha_nacimiento.isoformat()
            if hasattr(cliente.fecha_nacimiento, "isoformat")
            else str(cliente.fecha_nacimiento)
        )
    return RespuestaCliente(
        id=cliente.id,
        tipo_documento=cliente.tipo_documento,
        numero_documento=cliente.numero_documento,
        nombre=cliente.nombre,
        apellido=cliente.last_name,
        email=cliente.email,
        telefono=cliente.telefono,
        pais=getattr(cliente, "pais", "Colombia"),
        fecha_nacimiento=fecha_nac,
    )


class BuscarClientePorDocumento:
    def __init__(self, clients: ClientRepository) -> None:
        self.clients = clients

    def execute(self, tipo_documento: str, numero_documento: str) -> RespuestaCliente:
        cliente = self.clients.get_by_documento(tipo_documento.strip(), numero_documento.strip())
        if cliente is None:
            raise ClienteNoEncontrado(f"Cliente con {tipo_documento} {numero_documento} no encontrado")
        return _cliente_a_respuesta(cliente)


class GetClient:
    """Lectura interna por id o número de documento, para que el back-office muestre al asegurado."""

    def __init__(self, clients: ClientRepository) -> None:
        self.clients = clients

    def execute(self, client_id: str | None = None, numero_documento: str | None = None) -> RespuestaCliente:
        if client_id:
            cliente = self.clients.get(client_id.strip())
            missing_msg = f"Cliente {client_id} no encontrado"
        elif numero_documento:
            cliente = self.clients.get_by_numero_documento(numero_documento.strip())
            missing_msg = f"Cliente con documento {numero_documento} no encontrado"
        else:
            raise ClienteNoEncontrado("Debe especificar client_id o numero_documento")
        if cliente is None:
            raise ClienteNoEncontrado(missing_msg)
        return _cliente_a_respuesta(cliente)


ConsultarCliente = GetClient


MAX_CLIENTS_PER_LOOKUP = 100


class ListClients:
    """Lectura interna por lote, para que el back-office no pida un cliente a la vez."""

    def __init__(self, clients: ClientRepository) -> None:
        self.clients = clients

    def execute(self, client_ids: list[str]) -> list[RespuestaCliente]:
        unique = list(dict.fromkeys(client_id.strip() for client_id in client_ids if client_id.strip()))
        return [_cliente_a_respuesta(cliente) for cliente in self.clients.get_many(unique)]


class AsegurarCliente:
    def __init__(self, clients: ClientRepository) -> None:
        self.clients = clients

    def execute(self, solicitud: SolicitudAsegurarCliente) -> RespuestaCliente:
        tipo = solicitud.tipo_documento.strip().upper()
        numero = solicitud.numero_documento.strip()
        existente = self.clients.get_by_documento(tipo, numero)
        if existente is not None:
            return _cliente_a_respuesta(existente)

        nuevo_cliente = Client(
            id=id_cliente(tipo, numero),
            tipo_documento=tipo,
            numero_documento=numero,
            nombre=solicitud.nombre.strip() or "Cliente",
            last_name=solicitud.apellido.strip(),
            email=solicitud.email,
            telefono=solicitud.telefono.strip(),
            fecha_nacimiento=solicitud.fecha_nacimiento,
        )
        guardado = self.clients.upsert(nuevo_cliente)
        return _cliente_a_respuesta(guardado)
