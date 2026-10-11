from cotizacion.rating.domain.models import Cotizacion, SolicitudCotizacionViaje, SolicitudRating
from cotizacion.rating.domain.rating import ReglasRating, calcular_prima, calcular_prima_viaje


class CotizarUseCase:
    def __init__(self, reglas: ReglasRating, instancia: str) -> None:
        self.reglas = reglas
        self.instancia = instancia

    def execute(self, solicitud: SolicitudRating) -> Cotizacion:
        if isinstance(solicitud, SolicitudCotizacionViaje):
            prima = calcular_prima_viaje(self.reglas, solicitud)
        else:
            prima = calcular_prima(
                self.reglas, solicitud.producto_id, solicitud.suma_asegurada, solicitud.edad, solicitud.score_riesgo
            )
        return Cotizacion(
            producto_id=solicitud.producto_id,
            prima=prima,
            version_reglas=self.reglas.version,
            instancia=self.instancia,
        )
