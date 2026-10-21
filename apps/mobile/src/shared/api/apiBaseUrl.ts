import { Platform } from 'react-native';

import { readApiBaseUrl, writeApiBaseUrl } from './apiBaseUrlStorage';

export const cloudApiUrl = 'https://dzwq94g5om86y.cloudfront.net';

export type ApiTarget = 'cloud' | 'custom';

// The Android emulator reaches the host machine at 10.0.2.2. A physical device needs the PC's IP instead.
const defaultCustomUrl = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

// Starts on the cloud API until a saved choice is loaded.
let target: ApiTarget = 'cloud';
let customUrl = defaultCustomUrl;

export function normalizeApiUrl(url: string): string | null {
  const trimmed = url.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+(\/\S*)?$/.test(trimmed) ? trimmed : null;
}

export function getApiTarget(): ApiTarget {
  return target;
}

export function getCustomApiUrl(): string {
  return customUrl;
}

function persist() {
  // A failed write only loses the choice for the next launch.
  writeApiBaseUrl({ target, customUrl }).catch(() => undefined);
}

export async function loadApiBaseUrl() {
  try {
    const saved = await readApiBaseUrl();
    const normalized = saved ? normalizeApiUrl(saved.customUrl) : null;
    if (saved && normalized) {
      target = saved.target === 'custom' ? 'custom' : 'cloud';
      customUrl = normalized;
    }
  } catch {
    // An unreadable file leaves the default.
  }
}

export function selectCloudApi() {
  target = 'cloud';
  persist();
}

// Returns false and keeps the current setting when the URL is not valid.
export function selectCustomApi(url: string): boolean {
  const normalized = normalizeApiUrl(url);
  if (!normalized) {
    return false;
  }
  target = 'custom';
  customUrl = normalized;
  persist();
  return true;
}

export function getApiBaseUrl(): string {
  return target === 'cloud' ? cloudApiUrl : customUrl;
}
