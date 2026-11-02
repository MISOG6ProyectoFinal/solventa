import { payRenewal } from './payRenewal';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('payRenewal', () => {
  it('posts only the payment attempt', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        id: 'cobro-1',
        poliza_id: 'poliza-1',
        estado: 'aprobado',
        monto: '200000.00',
        moneda: 'COP',
      }),
    ) as typeof fetch;

    await payRenewal('poliza-1', 'intento-1');

    const [url, request] = jest.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/movil\/polizas\/poliza-1\/renovacion\/pagos$/);
    expect(JSON.parse(String(request?.body))).toEqual({ intento_id: 'intento-1' });
  });
});
