import httpx

from siniestros.prestadores.domain.models import Prestador

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# south, west, north, east
BOGOTA_BBOX = (4.46, -74.23, 4.84, -73.99)
TIMEOUT_S = 60.0
# Overpass answers 406 to clients that do not identify themselves.
HEADERS = {"User-Agent": "solventa-catalog-sync/1.0"}

TIPOS = {
    ("shop", "car_repair"): ("taller", "Taller"),
    ("emergency", "ambulance_station"): ("ambulancia", "Estación de ambulancias"),
}


def _query() -> str:
    bbox = ",".join(str(value) for value in BOGOTA_BBOX)
    filtros = "".join(f'nwr["{key}"="{value}"]({bbox});' for key, value in TIPOS)
    return f"[out:json][timeout:50];({filtros});out center;"


class OverpassCatalog:
    """Workshops and ambulance stations from OpenStreetMap (ODbL)."""

    def __init__(self, url: str = OVERPASS_URL, client: httpx.Client | None = None) -> None:
        self.url = url
        self.client = client or httpx.Client(timeout=TIMEOUT_S, headers=HEADERS)

    def fetch(self) -> list[Prestador]:
        response = self.client.post(self.url, data={"data": _query()})
        response.raise_for_status()
        prestadores = []
        for element in response.json()["elements"]:
            prestador = self._to_prestador(element)
            if prestador is not None:
                prestadores.append(prestador)
        return prestadores

    @staticmethod
    def _to_prestador(element: dict) -> Prestador | None:
        tags = element.get("tags", {})
        tipo = next((TIPOS[pair] for pair in TIPOS if tags.get(pair[0]) == pair[1]), None)
        # Ways and relations carry their position in `center`.
        point = element if "lat" in element else element.get("center")
        if tipo is None or point is None:
            return None
        return Prestador(
            origen="osm",
            origen_id=f"{element['type']}-{element['id']}",
            nombre=tags.get("name") or tipo[1],
            tipo=tipo[0],
            latitud=point["lat"],
            longitud=point["lon"],
        )
