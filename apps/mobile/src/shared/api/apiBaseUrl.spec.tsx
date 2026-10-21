import {
  cloudApiUrl,
  getApiBaseUrl,
  getApiTarget,
  loadApiBaseUrl,
  normalizeApiUrl,
  selectCloudApi,
  selectCustomApi,
} from './apiBaseUrl';

describe('apiBaseUrl', () => {
  beforeEach(() => {
    selectCloudApi();
  });

  it('points to the cloud API by default', () => {
    expect(getApiTarget()).toBe('cloud');
    expect(getApiBaseUrl()).toBe(cloudApiUrl);
  });

  it('points to a custom URL without trailing slashes', () => {
    expect(selectCustomApi(' http://192.168.1.20:8000/ ')).toBe(true);

    expect(getApiTarget()).toBe('custom');
    expect(getApiBaseUrl()).toBe('http://192.168.1.20:8000');
  });

  it('keeps the current setting when the URL is not valid', () => {
    expect(selectCustomApi('192.168.1.20')).toBe(false);

    expect(getApiTarget()).toBe('cloud');
  });

  it.each([
    ['http://10.0.2.2:8000', 'http://10.0.2.2:8000'],
    ['https://example.com/api/', 'https://example.com/api'],
    ['ftp://example.com', null],
    ['', null],
    ['http://', null],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeApiUrl(input)).toBe(expected);
  });

  it('restores the saved choice on the next launch', async () => {
    selectCustomApi('http://192.168.1.20:8000');
    await new Promise((resolve) => setImmediate(resolve));

    let relaunched!: typeof import('./apiBaseUrl');
    jest.isolateModules(() => {
      relaunched = require('./apiBaseUrl');
    });
    expect(relaunched.getApiBaseUrl()).toBe(cloudApiUrl);

    await relaunched.loadApiBaseUrl();

    expect(relaunched.getApiTarget()).toBe('custom');
    expect(relaunched.getApiBaseUrl()).toBe('http://192.168.1.20:8000');
  });

  it('keeps the default when nothing is saved', async () => {
    selectCloudApi();
    await new Promise((resolve) => setImmediate(resolve));
    await loadApiBaseUrl();

    expect(getApiBaseUrl()).toBe(cloudApiUrl);
  });
});
