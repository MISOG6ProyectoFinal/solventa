import { apiClient } from '../../../shared/api/client';
import { NEARBY_RADIUS_KM } from '../constants';
import { type NearbyProvider, type ProviderType } from '../types';

type Feature = {
  geometry: { coordinates: [number, number] };
  properties: {
    id: string;
    nombre: string;
    tipo: ProviderType;
    distancia_km: number;
    eta_min: number;
    calificacion: number | null;
  };
};

type FeatureCollection = { features: Feature[] };

type Center = { latitude: number; longitude: number };

export async function listNearbyProviders(center: Center, type?: ProviderType): Promise<NearbyProvider[]> {
  const params: [string, string | number][] = [
    ['lat', center.latitude],
    ['lon', center.longitude],
    ['radio_km', NEARBY_RADIUS_KM],
  ];
  if (type) {
    params.push(['servicio', type]);
  }
  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&');

  const collection = await apiClient.get<FeatureCollection>(`/movil/prestadores/cercanos?${query}`);

  return collection.features.map(({ geometry, properties }) => ({
    id: properties.id,
    name: properties.nombre,
    type: properties.tipo,
    distanceKm: properties.distancia_km,
    etaMin: properties.eta_min,
    rating: properties.calificacion,
    latitude: geometry.coordinates[1],
    longitude: geometry.coordinates[0],
  }));
}
