from cotizacion.rating.domain.models import (
    Cotizacion,
    SolicitudCotizacionMicroseguroVida,
    SolicitudCotizacionParametrico,
    SolicitudCotizacionViaje,
    SolicitudCotizacionVidaHipotecario,
    SolicitudRating,
)
from cotizacion.rating.domain.ports import RulesRepository
from cotizacion.rating.domain.rating import (
    calcular_desglose_generico,
    calcular_desglose_microseguro_vida,
    calcular_desglose_parametrico,
    calcular_desglose_viaje,
    calcular_desglose_vida_hipotecario,
)


class CotizarUseCase:
    def __init__(self, rules: RulesRepository, instancia: str) -> None:
        self.rules = rules
        self.instancia = instancia

    def execute(self, solicitud: SolicitudRating) -> Cotizacion:
        reglas = self.rules.current()
        if isinstance(solicitud, SolicitudCotizacionViaje):
            desglose = calcular_desglose_viaje(reglas, solicitud)
        elif isinstance(solicitud, SolicitudCotizacionMicroseguroVida):
            desglose = calcular_desglose_microseguro_vida(reglas, solicitud)
        elif isinstance(solicitud, SolicitudCotizacionVidaHipotecario):
            desglose = calcular_desglose_vida_hipotecario(reglas, solicitud)
        elif isinstance(solicitud, SolicitudCotizacionParametrico):
            desglose = calcular_desglose_parametrico(reglas, solicitud)
        else:
            desglose = calcular_desglose_generico(
                reglas,
                solicitud.producto_id,
                solicitud.suma_asegurada,
                solicitud.edad,
                solicitud.score_riesgo,
            )
        return Cotizacion(
            producto_id=solicitud.producto_id,
            prima=desglose.total,
            version_reglas=reglas.version,
            instancia=self.instancia,
            desglose=desglose,
        )
