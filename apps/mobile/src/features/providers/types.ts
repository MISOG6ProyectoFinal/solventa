export type ProviderType = 'grua' | 'taller' | 'perito' | 'ambulancia';

export type ProviderFilter = 'all' | ProviderType;

export type NearbyProvider = {
  id: string;
  name: string;
  type: ProviderType;
  distanceKm: number;
  etaMin: number;
  rating: number | null;
  latitude: number;
  longitude: number;
};
