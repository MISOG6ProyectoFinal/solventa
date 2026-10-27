import httpx
import pytest
from siniestros.prestadores.adapters.overpass_catalog import OverpassCatalog

RESPUESTA = {
    "elements": [
        {
            "type": "node",
            "id": 101,
            "lat": 4.65,
            "lon": -74.1,
            "tags": {"shop": "car_repair", "name": "Taller El Rayo"},
        },
        {
            "type": "way",
            "id": 202,
            "center": {"lat": 4.7, "lon": -74.05},
            "tags": {"emergency": "ambulance_station", "name": "Cruz Roja Chapinero"},
        },
        {"type": "node", "id": 303, "lat": 4.68, "lon": -74.08, "tags": {"shop": "car_repair"}},
        {"type": "node", "id": 404, "lat": 4.69, "lon": -74.07, "tags": {"amenity": "cafe", "name": "Café"}},
        {"type": "way", "id": 505, "tags": {"shop": "car_repair", "name": "Sin centro"}},
    ]
}


def _catalog(handler) -> OverpassCatalog:
    return OverpassCatalog(client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_mapea_talleres_y_estaciones_de_ambulancia_de_una_respuesta_grabada():
    capturadas: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        capturadas.append(request)
        return httpx.Response(200, json=RESPUESTA)

    prestadores = _catalog(handler).fetch()

    assert [(p.origen, p.origen_id, p.tipo, p.nombre) for p in prestadores] == [
        ("osm", "node-101", "taller", "Taller El Rayo"),
        ("osm", "way-202", "ambulancia", "Cruz Roja Chapinero"),
        ("osm", "node-303", "taller", "Taller"),
    ]
    assert (prestadores[1].latitud, prestadores[1].longitud) == (4.7, -74.05)
    assert all(p.calificacion is None for p in prestadores)
    consulta = capturadas[0].content.decode()
    assert "car_repair" in consulta
    assert "ambulance_station" in consulta


def test_un_error_http_se_propaga_para_que_la_sincronizacion_lo_registre():
    catalog = _catalog(lambda request: httpx.Response(504))

    with pytest.raises(httpx.HTTPStatusError):
        catalog.fetch()
