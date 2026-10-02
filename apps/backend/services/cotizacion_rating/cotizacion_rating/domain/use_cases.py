from cotizacion_rating.domain.models import Cotizacion, SolicitudCotizacion
from cotizacion_rating.domain.rating import ReglasRating, calcular_prima


class CotizarUseCase:
    def __init__(self, reglas: ReglasRating, instancia: str) -> None:
        self.reglas = reglas
        self.instancia = instancia

    def execute(self, solicitud: SolicitudCotizacion) -> Cotizacion:
        prima = calcular_prima(
            self.reglas, solicitud.producto_id, solicitud.suma_asegurada, solicitud.edad, solicitud.score_riesgo
        )
        return Cotizacion(
            producto_id=solicitud.producto_id,
            prima=prima,
            version_reglas=self.reglas.version,
            instancia=self.instancia,
        )
