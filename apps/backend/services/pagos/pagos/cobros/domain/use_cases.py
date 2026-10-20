"""Cobra una prima. La misma clave reconcilia; una cotización solo puede aprobarse una vez."""

from pagos.cobros.domain.models import Cobro, EstadoCobro, SolicitudCobro
from pagos.cobros.domain.ports import CobroDuplicado, CobroRepository, PasarelaNoDisponible, PasarelaPort


class CobrarPrimaUseCase:
    def __init__(self, cobros: CobroRepository, pasarela: PasarelaPort) -> None:
        self.cobros = cobros
        self.pasarela = pasarela

    def execute(self, solicitud: SolicitudCobro) -> Cobro:
        for _ in range(3):
            cobro = self._resolver(solicitud)
            if cobro is not None:
                return cobro
        raise PasarelaNoDisponible("No se pudo registrar el cobro")

    def _resolver(self, solicitud: SolicitudCobro) -> Cobro | None:
        por_clave = self.cobros.get_by_idempotency_key(solicitud.idempotency_key)
        if por_clave is not None:
            if por_clave.estado != EstadoCobro.PROCESANDO:
                return por_clave
            return self._cerrar(por_clave, solicitud.medio_token)

        por_cotizacion = self.cobros.get_by_cotizacion_id(solicitud.cotizacion_id)
        if por_cotizacion is None:
            return self._iniciar(solicitud)
        if por_cotizacion.estado == EstadoCobro.APROBADO:
            return por_cotizacion
        if por_cotizacion.estado == EstadoCobro.PROCESANDO:
            cerrado = self._cerrar(por_cotizacion, solicitud.medio_token)
            if cerrado.estado != EstadoCobro.RECHAZADO or cerrado.idempotency_key == solicitud.idempotency_key:
                return cerrado
            por_cotizacion = cerrado
        return self._reclamar(por_cotizacion, solicitud)

    def _iniciar(self, solicitud: SolicitudCobro) -> Cobro | None:
        cobro = Cobro(
            cotizacion_id=solicitud.cotizacion_id,
            cliente_id=solicitud.cliente_id,
            monto=solicitud.monto,
            moneda=solicitud.moneda,
            estado=EstadoCobro.PROCESANDO,
            idempotency_key=solicitud.idempotency_key,
        )
        try:
            self.cobros.add(cobro)
        except CobroDuplicado:
            return None
        return self._cerrar(cobro, solicitud.medio_token)

    def _reclamar(self, actual: Cobro, solicitud: SolicitudCobro) -> Cobro | None:
        reemplazo = actual.model_copy(
            update={
                "estado": EstadoCobro.PROCESANDO,
                "idempotency_key": solicitud.idempotency_key,
                "monto": solicitud.monto,
                "moneda": solicitud.moneda,
                "cliente_id": solicitud.cliente_id,
            }
        )
        reclamado = self.cobros.claim_nuevo_intento(actual.id, actual.idempotency_key, reemplazo)
        if reclamado is None:
            return None
        return self._cerrar(reclamado, solicitud.medio_token)

    def _cerrar(self, cobro: Cobro, medio_token: str) -> Cobro:
        cobro.estado = EstadoCobro(self._cobrar(cobro, medio_token))
        self.cobros.update(cobro)
        return cobro

    def _cobrar(self, cobro: Cobro, medio_token: str) -> str:
        try:
            resultado = self.pasarela.charge(float(cobro.monto), cobro.moneda, medio_token, cobro.idempotency_key)
        except PasarelaNoDisponible:
            raise
        except Exception as exc:
            raise PasarelaNoDisponible("Pasarela de pagos no disponible") from exc
        estado = str(resultado.get("estado", "")) if isinstance(resultado, dict) else ""
        if estado not in (EstadoCobro.APROBADO, EstadoCobro.RECHAZADO):
            raise PasarelaNoDisponible("La pasarela no devolvió un resultado reconocible")
        return estado
