import { NEARBY_RADIUS_KM } from '../constants';
import { listNearbyProviders } from './listNearbyProviders';

const CENTER = { latitude: 4.6683, longitude: -74.0531 };

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const COLLECTION = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-74.0636, 4.6533] },
      properties: {
        id: 'seed-grua-01',
        nombre: 'Grúas Aliadas Chapinero',
        tipo: 'grua',
        distancia_km: 2.4,
        eta_min: 11,
        calificacion: 4.5,
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-74.1, 4.65] },
      properties: {
        id: 'osm-node-101',
        nombre: 'Taller El Rayo',
        tipo: 'taller',
        distancia_km: 5.1,
        eta_min: 17,
        calificacion: null,
      },
    },
  ],
};

describe('listNearbyProviders', () => {
  it('queries the configured radius around the position', async () => {
    global.fetch = jest.fn(async () => jsonResponse(COLLECTION)) as typeof fetch;

    await listNearbyProviders(CENTER);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(String.raw`/movil/prestadores/cercanos\?lat=4\.6683&lon=-74\.0531&radio_km=${NEARBY_RADIUS_KM}$`)),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('adds the category when one is chosen', async () => {
    global.fetch = jest.fn(async () => jsonResponse(COLLECTION)) as typeof fetch;

    await listNearbyProviders(CENTER, 'grua');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`radio_km=${NEARBY_RADIUS_KM}&servicio=grua$`)),
      expect.anything(),
    );
  });

  it('maps the GeoJSON features, reading the position as [lon, lat]', async () => {
    global.fetch = jest.fn(async () => jsonResponse(COLLECTION)) as typeof fetch;

    await expect(listNearbyProviders(CENTER)).resolves.toEqual([
      {
        id: 'seed-grua-01',
        name: 'Grúas Aliadas Chapinero',
        type: 'grua',
        distanceKm: 2.4,
        etaMin: 11,
        rating: 4.5,
        latitude: 4.6533,
        longitude: -74.0636,
      },
      {
        id: 'osm-node-101',
        name: 'Taller El Rayo',
        type: 'taller',
        distanceKm: 5.1,
        etaMin: 17,
        rating: null,
        latitude: 4.65,
        longitude: -74.1,
      },
    ]);
  });

  it('returns an empty list when nothing is in range', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ type: 'FeatureCollection', features: [] })) as typeof fetch;

    await expect(listNearbyProviders(CENTER)).resolves.toEqual([]);
  });

  it('rejects with the server detail on an error', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ detail: 'Servicio no disponible.' }, 503)) as typeof fetch;

    await expect(listNearbyProviders(CENTER)).rejects.toThrow('Servicio no disponible.');
  });
});
