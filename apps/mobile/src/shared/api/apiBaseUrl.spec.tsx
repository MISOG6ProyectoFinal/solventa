import ReactNativeBlobUtil from 'react-native-blob-util';

import {
  getApiBaseUrl,
  getApiTarget,
  getBuildApiBaseUrl,
  loadApiBaseUrl,
  normalizeApiUrl,
  selectBuildApi,
  selectCustomApi,
} from './apiBaseUrl';
import { writeApiBaseUrl } from './apiBaseUrlStorage';

const buildUrl = getBuildApiBaseUrl();

describe('apiBaseUrl', () => {
  beforeEach(() => {
    global.__DEV__ = true;
    selectBuildApi();
  });

  it('uses API_BASE_URL by default', () => {
    expect(getApiTarget()).toBe('build');
    expect(getApiBaseUrl()).toBe(buildUrl);
    expect(buildUrl).toBe(process.env.API_BASE_URL);
  });

  it('points to a custom URL without trailing slashes', () => {
    expect(selectCustomApi(' http://192.168.1.20:8000/ ')).toBe(true);

    expect(getApiTarget()).toBe('custom');
    expect(getApiBaseUrl()).toBe('http://192.168.1.20:8000');
  });

  it('keeps the current setting when the URL is not valid', () => {
    expect(selectCustomApi('192.168.1.20')).toBe(false);

    expect(getApiTarget()).toBe('build');
    expect(getApiBaseUrl()).toBe(buildUrl);
  });

  it('returns to API_BASE_URL when the build target is selected', () => {
    selectCustomApi('http://192.168.1.20:8000');
    selectBuildApi();

    expect(getApiTarget()).toBe('build');
    expect(getApiBaseUrl()).toBe(buildUrl);
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

  it('starts from API_BASE_URL before a saved override is loaded', () => {
    let relaunched!: typeof import('./apiBaseUrl');
    jest.isolateModules(() => {
      relaunched = require('./apiBaseUrl');
    });

    expect(relaunched.getApiTarget()).toBe('build');
    expect(relaunched.getApiBaseUrl()).toBe(buildUrl);
  });

  it('restores the saved custom override on the next launch', async () => {
    selectCustomApi('http://192.168.1.20:8000');
    await new Promise((resolve) => setImmediate(resolve));

    let relaunched!: typeof import('./apiBaseUrl');
    jest.isolateModules(() => {
      relaunched = require('./apiBaseUrl');
    });
    expect(relaunched.getApiBaseUrl()).toBe(buildUrl);

    await relaunched.loadApiBaseUrl();

    expect(relaunched.getApiTarget()).toBe('custom');
    expect(relaunched.getApiBaseUrl()).toBe('http://192.168.1.20:8000');
  });

  it('keeps API_BASE_URL when nothing is saved', async () => {
    const path = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/api-base-url.json`;
    if (await ReactNativeBlobUtil.fs.exists(path)) {
      await ReactNativeBlobUtil.fs.unlink(path);
    }

    await loadApiBaseUrl();

    expect(getApiTarget()).toBe('build');
    expect(getApiBaseUrl()).toBe(buildUrl);
  });

  it('ignores a previously saved cloud choice', async () => {
    await writeApiBaseUrl({ target: 'cloud', customUrl: 'http://192.168.1.20:8000' });

    let relaunched!: typeof import('./apiBaseUrl');
    jest.isolateModules(() => {
      relaunched = require('./apiBaseUrl');
    });
    await relaunched.loadApiBaseUrl();

    expect(relaunched.getApiTarget()).toBe('build');
    expect(relaunched.getApiBaseUrl()).toBe(buildUrl);
  });

  it('ignores a saved override in a release build', async () => {
    selectCustomApi('http://192.168.1.20:8000');
    await new Promise((resolve) => setImmediate(resolve));

    let relaunched!: typeof import('./apiBaseUrl');
    jest.isolateModules(() => {
      relaunched = require('./apiBaseUrl');
    });
    global.__DEV__ = false;
    try {
      await relaunched.loadApiBaseUrl();

      expect(relaunched.getApiTarget()).toBe('build');
      expect(relaunched.getApiBaseUrl()).toBe(buildUrl);
      expect(relaunched.selectCustomApi('http://10.0.2.2:8000')).toBe(false);
      relaunched.selectBuildApi();
      expect(relaunched.getApiBaseUrl()).toBe(buildUrl);
    } finally {
      global.__DEV__ = true;
    }
  });
});
