import { getAccessToken } from './accessToken';
import { getApiBaseUrl } from './apiBaseUrl';
import { notifyUnauthorized } from './unauthorized';

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(status: number, detail: string | null) {
    super(detail ?? '');
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.detail) {
    return error.detail;
  }
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return fallback;
}

function detailText(detail: unknown): string | null {
  if (typeof detail === 'string') {
    return detail;
  }
  if (typeof detail === 'object' && detail !== null && !Array.isArray(detail)) {
    const mensaje = (detail as { mensaje?: unknown }).mensaje;
    if (typeof mensaje === 'string' && mensaje !== '') {
      return mensaje;
    }
  }
  return null;
}

function requestHeaders(payload: unknown): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

async function requestJson<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  payload?: unknown,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: requestHeaders(payload),
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as { detail?: unknown; } | null;
  if (!response.ok) {
    // Without a token the 401 is a login failure, not an expired session.
    if (response.status === 401 && getAccessToken()) {
      notifyUnauthorized();
    }
    const detail = body ? detailText(body.detail) : null;
    throw new ApiError(response.status, detail);
  }

  return body as T;
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return requestJson<T>('GET', path);
  },

  post<T>(path: string, payload?: unknown): Promise<T> {
    return requestJson<T>('POST', path, payload);
  },

  put<T>(path: string, payload?: unknown): Promise<T> {
    return requestJson<T>('PUT', path, payload);
  },

  patch<T>(path: string, payload?: unknown): Promise<T> {
    return requestJson<T>('PATCH', path, payload);
  },

  delete<T>(path: string, payload?: unknown): Promise<T> {
    return requestJson<T>('DELETE', path, payload);
  },
};
