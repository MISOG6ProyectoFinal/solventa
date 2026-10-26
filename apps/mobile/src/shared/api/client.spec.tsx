import { useLanguageStore } from '../i18n/useLanguageStore';
import { setAccessToken } from './accessToken';
import { getBuildApiBaseUrl, selectBuildApi, selectCustomApi } from './apiBaseUrl';
import { ApiError, apiClient } from './client';
import { setUnauthorizedHandler } from './unauthorized';

const baseUrl = getBuildApiBaseUrl();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('apiClient', () => {
  beforeEach(() => {
    setAccessToken(null);
    selectBuildApi();
    global.fetch = jest.fn();
  });

  it('posts JSON to the app API and returns the body', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse({ id: 'aviso-1' }, 201) as Response);

    await expect(apiClient.post('/movil/siniestros', { poliza_id: 'SLV-2026-03105' })).resolves.toEqual({
      id: 'aviso-1',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/movil/siniestros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'es' },
      body: JSON.stringify({ poliza_id: 'SLV-2026-03105' }),
    });
  });

  it('posts without a body when no payload is given', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse({ estado: 'disponible' }) as Response);

    await apiClient.post('/movil/siniestros/aviso-1/evidencias/ev-1/confirmar');

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/movil/siniestros/aviso-1/evidencias/ev-1/confirmar`,
      {
        method: 'POST',
        headers: { 'Accept-Language': 'es' },
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

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/movil/siniestros/aviso-1`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'es' },
      body: JSON.stringify({ estado: 'borrador' }),
    });
  });

  it('deletes without a body when no payload is given', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse(null, 204) as Response);

    await apiClient.delete('/movil/siniestros/aviso-1');

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/movil/siniestros/aviso-1`, {
      method: 'DELETE',
      headers: { 'Accept-Language': 'es' },
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

  it('sends the bearer token when a session exists', async () => {
    setAccessToken('token-firmado');
    jest.mocked(fetch).mockResolvedValue(jsonResponse({ cliente_id: 'cliente-1' }) as Response);

    await apiClient.get('/movil/sesion');

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/movil/sesion`, {
      method: 'GET',
      headers: { 'Accept-Language': 'es', Authorization: 'Bearer token-firmado' },
      body: undefined,
    });
  });

  it('sends the current app language on every request', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse({}) as Response);
    useLanguageStore.setState({ language: 'en' });

    await apiClient.get('/movil/sesion');

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/movil/sesion`,
      expect.objectContaining({ headers: { 'Accept-Language': 'en' } }),
    );
  });

  it('sends requests to the selected API base URL', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse({}) as Response);
    selectCustomApi('http://192.168.1.20:8000');

    await apiClient.get('/movil/sesion');

    expect(fetch).toHaveBeenCalledWith('http://192.168.1.20:8000/movil/sesion', expect.anything());
  });

  it('reads JSON with get', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse([{ id: 'ev-1' }]) as Response);

    await expect(apiClient.get('/movil/siniestros/aviso-1/evidencias')).resolves.toEqual([{ id: 'ev-1' }]);

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/movil/siniestros/aviso-1/evidencias`, {
      method: 'GET',
      headers: { 'Accept-Language': 'es' },
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

  it('reads the message from a structured business error', async () => {
    jest.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          detail: {
            codigo: 'cotizacion_vencida',
            mensaje: 'Esta cotización ya no está vigente. No se realizó ningún cobro; vuelve a cotizar.',
          },
        },
        409,
      ) as Response,
    );

    await expect(apiClient.post('/movil/cotizaciones/oferta-1/pagos', {})).rejects.toMatchObject({
      status: 409,
      detail: 'Esta cotización ya no está vigente. No se realizó ningún cobro; vuelve a cotizar.',
    });
  });

  it('throws an error with no detail when the response has none', async () => {
    jest.mocked(fetch).mockResolvedValue(jsonResponse({ detail: ['campo'] }, 422) as Response);

    await expect(apiClient.get('/movil/siniestros')).rejects.toMatchObject({
      status: 422,
      detail: null,
    });
  });

  describe('when the server rejects the session', () => {
    const unauthorized = jest.fn();

    beforeEach(() => {
      unauthorized.mockClear();
      setUnauthorizedHandler(unauthorized);
      jest.mocked(fetch).mockResolvedValue(jsonResponse({ detail: 'La sesión no es válida' }, 401) as Response);
    });

    afterEach(() => {
      setUnauthorizedHandler(null);
    });

    it('notifies the handler and still throws when a signed-in request gets 401', async () => {
      setAccessToken('token-vencido');

      await expect(apiClient.get('/movil/siniestros')).rejects.toMatchObject({ status: 401 });

      expect(unauthorized).toHaveBeenCalledTimes(1);
    });

    it('does not notify the handler when no token was sent, such as a wrong password at login', async () => {
      await expect(apiClient.post('/movil/sesiones', {})).rejects.toMatchObject({ status: 401 });

      expect(unauthorized).not.toHaveBeenCalled();
    });

    it('does not notify the handler for other errors', async () => {
      setAccessToken('token-vigente');
      jest.mocked(fetch).mockResolvedValue(jsonResponse({ detail: 'Prohibido' }, 403) as Response);

      await expect(apiClient.get('/movil/siniestros')).rejects.toMatchObject({ status: 403 });

      expect(unauthorized).not.toHaveBeenCalled();
    });
  });
});
