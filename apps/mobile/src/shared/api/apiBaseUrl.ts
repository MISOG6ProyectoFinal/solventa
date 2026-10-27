import { readApiBaseUrl, writeApiBaseUrl } from './apiBaseUrlStorage';

export type ApiTarget = 'build' | 'custom';

const schemes = ['http:', 'https:'];

function readBuildApiBaseUrl(): string {
  const configured = process.env.API_BASE_URL;
  if (configured === undefined || configured === '') {
    throw new Error('Falta API_BASE_URL.');
  }
  return configured;
}

// Inlined from apps/mobile/.env by Babel. Local and CI/CD builds both set this value.
const buildApiBaseUrl = readBuildApiBaseUrl();

// Starting value of the DevTools field. Requests keep using API_BASE_URL until an explicit override.
export const defaultCustomUrl = buildApiBaseUrl;

// Dev-only override. A release build always uses the URL from the build.
let target: ApiTarget = 'build';
let customUrl = defaultCustomUrl;

export function getBuildApiBaseUrl(): string {
  return buildApiBaseUrl;
}

export function normalizeApiUrl(url: string): string | null {
  let trimmed = url.trim();
  while (trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1);
  }
  const separator = trimmed.indexOf('://');
  const host = trimmed.slice(separator + 3);
  const valid =
    separator > 0 && schemes.includes(trimmed.slice(0, separator + 1)) && host !== '' && !host.startsWith('/');
  return valid && !/\s/.test(trimmed) ? trimmed : null;
}

export function getApiTarget(): ApiTarget {
  return __DEV__ && target === 'custom' ? 'custom' : 'build';
}

export function getCustomApiUrl(): string {
  return customUrl;
}

function persist() {
  if (!__DEV__) {
    return;
  }
  // A failed write only loses the choice for the next launch.
  writeApiBaseUrl({ target, customUrl }).catch(() => undefined);
}

export async function loadApiBaseUrl() {
  if (!__DEV__) {
    return;
  }
  try {
    const saved = await readApiBaseUrl();
    const normalized = saved ? normalizeApiUrl(saved.customUrl) : null;
    // Only an explicit custom override replaces API_BASE_URL.
    // A legacy "cloud" choice is ignored so it cannot pin the app to a hardcoded host.
    if (saved?.target === 'custom' && normalized) {
      target = 'custom';
      customUrl = normalized;
      return;
    }
  } catch {
    // An unreadable file leaves the build URL.
  }
  target = 'build';
}

export function selectBuildApi() {
  target = 'build';
  persist();
}

// Returns false and keeps the current setting when the URL is not valid.
export function selectCustomApi(url: string): boolean {
  const normalized = normalizeApiUrl(url);
  if (!normalized || !__DEV__) {
    return false;
  }
  target = 'custom';
  customUrl = normalized;
  persist();
  return true;
}

export function getApiBaseUrl(): string {
  return getApiTarget() === 'custom' ? customUrl : buildApiBaseUrl;
}
