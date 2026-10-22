import math

from siniestros.prestadores.domain.models import MAX_RESULTADOS, ConsultaCercanos, Prestador

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = (phi2 - phi1) / 2
    d_lambda = math.radians(lon2 - lon1) / 2
    a = math.sin(d_phi) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


class InMemoryPrestadorRepository:
    def __init__(self) -> None:
        self.prestadores: dict[tuple[str, str], Prestador] = {}

    def upsert(self, prestadores: list[Prestador]) -> None:
        for prestador in prestadores:
            self.prestadores[(prestador.origen, prestador.origen_id)] = prestador

    def cercanos(self, consulta: ConsultaCercanos) -> list[tuple[Prestador, float]]:
        encontrados = [
            (prestador, haversine_km(consulta.lat, consulta.lon, prestador.latitud, prestador.longitud))
            for prestador in self.prestadores.values()
            if consulta.servicio is None or prestador.tipo == consulta.servicio
        ]
        dentro = [item for item in encontrados if item[1] <= consulta.radio_km]
        return sorted(dentro, key=lambda item: item[1])[:MAX_RESULTADOS]
