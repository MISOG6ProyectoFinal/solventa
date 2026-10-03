import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export type Place = {
  address: string;
  gps: string;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  municipality?: string;
};

type NominatimPlace = {
  display_name?: string;
  address?: NominatimAddress;
};

const currentLocation = 'Ubicación actual';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

function formatGps(latitude: number, longitude: number, accuracy: number) {
  return `GPS ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${Math.round(accuracy)} m)`;
}

function formatAddress(place: NominatimPlace) {
  const address = place.address;
  if (!address) {
    return place.display_name ?? null;
  }

  const street = [address.road, address.house_number].filter(Boolean).join(' ');
  const area = address.suburb ?? address.neighbourhood;
  const city = address.city ?? address.town ?? address.municipality;
  const line = [street, area, city].filter((part) => part && part.length > 0).join(', ');

  return line || place.display_name || null;
}

async function allowLocation() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return new Promise<boolean>((resolve) => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    );
  });
}

function currentPosition() {
  return new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      reject,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  });
}

async function lookupAddress(latitude: number, longitude: number) {
  const endpoint = new URL('https://nominatim.openstreetmap.org/reverse');
  endpoint.searchParams.set('lat', String(latitude));
  endpoint.searchParams.set('lon', String(longitude));
  endpoint.searchParams.set('format', 'jsonv2');
  endpoint.searchParams.set('accept-language', 'es');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Solventa/1.0',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const place = (await response.json()) as NominatimPlace;
    return formatAddress(place);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let reading: Promise<Place> | null = null;

async function loadPlace(): Promise<Place> {
  const allowed = await allowLocation();
  if (!allowed) {
    throw new Error('Location permission was denied');
  }

  const position = await currentPosition();
  const address = await lookupAddress(position.latitude, position.longitude);

  return {
    address: address ?? currentLocation,
    gps: formatGps(position.latitude, position.longitude, position.accuracy),
  };
}

export function readLocation(options?: { fresh?: boolean }): Promise<Place> {
  if (options?.fresh || !reading) {
    const next = loadPlace().catch((error: unknown) => {
      if (reading === next) {
        reading = null;
      }
      throw error;
    });
    reading = next;
  }

  return reading;
}
