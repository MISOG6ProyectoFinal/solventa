const apiBaseUrl = 'http://localhost:8000';

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

async function requestJson<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  payload?: unknown,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  if (!response.ok) {
    const detail = body && typeof body.detail === 'string' ? body.detail : null;
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
