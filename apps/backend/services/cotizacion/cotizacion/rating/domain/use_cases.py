from cotizacion.rating.domain.models import (
    Cotizacion,
    SolicitudCotizacionMicroseguroVida,
    SolicitudCotizacionParametrico,
    SolicitudCotizacionViaje,
    SolicitudCotizacionVidaHipotecario,
    SolicitudRating,
)
from cotizacion.rating.domain.rating import (
    ReglasRating,
    calcular_desglose_generico,
    calcular_desglose_microseguro_vida,
    calcular_desglose_parametrico,
    calcular_desglose_viaje,
    calcular_desglose_vida_hipotecario,
)


class CotizarUseCase:
    def __init__(self, reglas: ReglasRating, instancia: str) -> None:
        self.reglas = reglas
        self.instancia = instancia

    def execute(self, solicitud: SolicitudRating) -> Cotizacion:
        if isinstance(solicitud, SolicitudCotizacionViaje):
            desglose = calcular_desglose_viaje(self.reglas, solicitud)
        elif isinstance(solicitud, SolicitudCotizacionMicroseguroVida):
            desglose = calcular_desglose_microseguro_vida(self.reglas, solicitud)
        elif isinstance(solicitud, SolicitudCotizacionVidaHipotecario):
            desglose = calcular_desglose_vida_hipotecario(self.reglas, solicitud)
        elif isinstance(solicitud, SolicitudCotizacionParametrico):
            desglose = calcular_desglose_parametrico(self.reglas, solicitud)
        else:
            desglose = calcular_desglose_generico(
                self.reglas,
                solicitud.producto_id,
                solicitud.suma_asegurada,
                solicitud.edad,
                solicitud.score_riesgo,
            )
        return Cotizacion(
            producto_id=solicitud.producto_id,
            prima=desglose.total,
            version_reglas=self.reglas.version,
            instancia=self.instancia,
            desglose=desglose,
        )
