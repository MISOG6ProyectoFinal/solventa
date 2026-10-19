"""Cobra una prima una sola vez por clave de idempotencia."""

from pagos.cobros.domain.models import Cobro, EstadoCobro, SolicitudCobro
from pagos.cobros.domain.ports import CobroDuplicado, CobroRepository, PasarelaNoDisponible, PasarelaPort


class CobrarPrimaUseCase:
    def __init__(self, cobros: CobroRepository, pasarela: PasarelaPort) -> None:
        self.cobros = cobros
        self.pasarela = pasarela

    def execute(self, solicitud: SolicitudCobro) -> Cobro:
        conocido = self.cobros.get_by_idempotency_key(solicitud.idempotency_key)
        if conocido is not None:
            return conocido

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
            existente = self.cobros.get_by_idempotency_key(solicitud.idempotency_key)
            if existente is None:
                raise
            return existente

        resultado = self._cobrar(solicitud)
        cobro.estado = EstadoCobro(resultado)
        self.cobros.update(cobro)
        return cobro

    def _cobrar(self, solicitud: SolicitudCobro) -> str:
        try:
            resultado = self.pasarela.charge(
                float(solicitud.monto),
                solicitud.moneda,
                solicitud.medio_token,
                solicitud.idempotency_key,
            )
        except PasarelaNoDisponible:
            raise
        except Exception as exc:
            raise PasarelaNoDisponible("Pasarela de pagos no disponible") from exc
        estado = str(resultado.get("estado", "")) if isinstance(resultado, dict) else ""
        if estado not in (EstadoCobro.APROBADO, EstadoCobro.RECHAZADO):
            raise PasarelaNoDisponible("La pasarela no devolvió un resultado reconocible")
        return estado
