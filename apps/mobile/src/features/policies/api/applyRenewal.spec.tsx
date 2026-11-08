import { applyRenewal } from './applyRenewal';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('applyRenewal', () => {
  it('posts only the approved payment id', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        poliza_id: 'poliza-1',
        numero_poliza: 'POL-1',
        producto_id: 'viaje-internacional',
        estado: 'aplicada',
        cobro_id: 'cobro-1',
        vigencia_anterior: { desde: '2026-01-01', hasta: '2026-12-31' },
        vigencia_nueva: { desde: '2027-01-01', hasta: '2027-12-31' },
        coberturas: [],
      }),
    ) as typeof fetch;

    await applyRenewal('poliza-1', 'cobro-1');

    const [url, request] = jest.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/movil\/polizas\/poliza-1\/renovaciones$/);
    expect(JSON.parse(String(request?.body))).toEqual({ cobro_id: 'cobro-1' });
  });
});
