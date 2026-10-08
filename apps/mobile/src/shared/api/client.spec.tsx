import { readFileSync } from 'fs';
import { join } from 'path';

import { ApiError, apiClient } from './client';

function apiBaseUrl(): string {
  const envFile = readFileSync(join(__dirname, '../../../.env'), 'utf8');
  const line = envFile.split(/\r?\n/).find((entry) => entry.startsWith('API_BASE_URL='));
  const value = line?.slice('API_BASE_URL='.length).trim();
  if (!value) {
    throw new Error('API_BASE_URL is missing from .env');
  }

  return value;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('apiClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('posts JSON to the app API and returns the body', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse({ id: 'aviso-1' }, 201) as Response);

    await expect(apiClient.post('/movil/siniestros', { poliza_id: 'SLV-2026-03105' })).resolves.toEqual({
      id: 'aviso-1',
    });

    expect(fetch).toHaveBeenCalledWith(`${apiBaseUrl()}/movil/siniestros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poliza_id: 'SLV-2026-03105' }),
    });
  });

  it('posts without a body when no payload is given', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse({ estado: 'disponible' }) as Response);

    await apiClient.post('/movil/siniestros/aviso-1/evidencias/ev-1/confirmar');

    expect(fetch).toHaveBeenCalledWith(
      `${apiBaseUrl()}/movil/siniestros/aviso-1/evidencias/ev-1/confirmar`,
      {
        method: 'POST',
        headers: undefined,
        body: undefined,
      },
    );
  });

  it.each([
    ['put', 'PUT'],
    ['patch', 'PATCH'],
    ['delete', 'DELETE'],
  ] as const)('sends JSON with %s and returns the body', async (name, method) => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse({ id: 'aviso-1' }) as Response);

    await expect(apiClient[name]('/movil/siniestros/aviso-1', { estado: 'borrador' })).resolves.toEqual({
      id: 'aviso-1',
    });

    expect(fetch).toHaveBeenCalledWith(`${apiBaseUrl()}/movil/siniestros/aviso-1`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'borrador' }),
    });
  });

  it('deletes without a body when no payload is given', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse(null, 204) as Response);

    await apiClient.delete('/movil/siniestros/aviso-1');

    expect(fetch).toHaveBeenCalledWith(`${apiBaseUrl()}/movil/siniestros/aviso-1`, {
      method: 'DELETE',
      headers: undefined,
      body: undefined,
    });
  });

  it.each(['put', 'patch', 'delete'] as const)('throws the server detail when %s fails', async (name) => {
    jest
      .mocked(fetch)
      .mockResolvedValue(jsonResponse({ detail: 'Este reporte ya tiene 10 evidencias.' }, 409) as Response);

    await expect(apiClient[name]('/movil/siniestros/aviso-1')).rejects.toMatchObject({
      status: 409,
      detail: 'Este reporte ya tiene 10 evidencias.',
    });
  });

  it('reads JSON with get', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse([{ id: 'ev-1' }]) as Response);

    await expect(apiClient.get('/movil/siniestros/aviso-1/evidencias')).resolves.toEqual([{ id: 'ev-1' }]);

    expect(fetch).toHaveBeenCalledWith(`${apiBaseUrl()}/movil/siniestros/aviso-1/evidencias`, {
      method: 'GET',
      headers: undefined,
      body: undefined,
    });
  });

  it('throws the server detail when the response fails', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue(jsonResponse({ detail: 'El archivo no pasó la validación.' }, 422) as Response);

    const failed = apiClient.post('/movil/siniestros');

    await expect(failed).rejects.toThrow(ApiError);
    await expect(failed).rejects.toMatchObject({
      status: 422,
      detail: 'El archivo no pasó la validación.',
    });
  });

  it('throws an error with no detail when the response has none', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse({ detail: ['campo'] }, 422) as Response);

    await expect(apiClient.get('/movil/siniestros')).rejects.toMatchObject({
      status: 422,
      detail: null,
    });
  });
});
