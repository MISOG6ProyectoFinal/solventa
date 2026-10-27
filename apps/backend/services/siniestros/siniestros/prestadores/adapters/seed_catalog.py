import json
from pathlib import Path

from siniestros.prestadores.domain.models import Prestador

SEED = Path(__file__).parent / "seed" / "aliados.geojson"


class SeedCatalog:
    """Prototype allies. Tow trucks and adjusters have no open data source, so they only exist here."""

    def fetch(self) -> list[Prestador]:
        features = json.loads(SEED.read_text(encoding="utf-8"))["features"]
        return [
            Prestador(
                origen="seed",
                origen_id=feature["properties"]["id"],
                nombre=feature["properties"]["nombre"],
                tipo=feature["properties"]["tipo"],
                latitud=feature["geometry"]["coordinates"][1],
                longitud=feature["geometry"]["coordinates"][0],
                calificacion=feature["properties"]["calificacion"],
            )
            for feature in features
        ]
