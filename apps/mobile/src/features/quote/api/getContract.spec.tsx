import { getContract } from './getContract';

describe('getContract', () => {
  it('reads the contract of the product with the options of each field', async () => {
    const contract = { properties: { destino: { enum: ['España'] } } };
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => contract })) as unknown as typeof fetch;

    await expect(getContract('viaje-internacional')).resolves.toEqual(contract);

    const [url] = jest.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/movil\/productos\/viaje-internacional\/contrato$/);
  });
});
