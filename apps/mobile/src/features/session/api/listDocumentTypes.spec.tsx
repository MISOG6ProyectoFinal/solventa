import { listDocumentTypes } from './listDocumentTypes';

describe('listDocumentTypes', () => {
  it('reads the document types the identity service publishes', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ['CC', 'CE', 'Pasaporte'],
    })) as unknown as typeof fetch;

    await expect(listDocumentTypes()).resolves.toEqual(['CC', 'CE', 'Pasaporte']);

    const [url] = jest.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/movil\/tipos-documento$/);
  });
});
