import ReactNativeBlobUtil from 'react-native-blob-util';

import { getDeviceLanguage } from './deviceLanguage';
import { useLanguageStore } from './useLanguageStore';

jest.mock('./deviceLanguage', () => ({ getDeviceLanguage: jest.fn(() => 'es') }));

const file = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/language.json`;

describe('useLanguageStore', () => {
  beforeEach(async () => {
    await ReactNativeBlobUtil.fs.unlink(file);
    jest.mocked(getDeviceLanguage).mockReturnValue('es');
    useLanguageStore.setState({ language: 'es', loaded: false });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the device language when nothing is saved', async () => {
    jest.mocked(getDeviceLanguage).mockReturnValue('en');

    await useLanguageStore.getState().load();

    expect(useLanguageStore.getState().language).toBe('en');
    expect(useLanguageStore.getState().loaded).toBe(true);
  });

  it('restores the saved language over the device language', async () => {
    await ReactNativeBlobUtil.fs.writeFile(file, JSON.stringify({ language: 'en' }), 'utf8');

    await useLanguageStore.getState().load();

    expect(useLanguageStore.getState().language).toBe('en');
  });

  it.each(['not json', JSON.stringify({ language: 'fr' })])(
    'falls back to the device language when the file holds %p',
    async (contents) => {
      jest.mocked(getDeviceLanguage).mockReturnValue('en');
      await ReactNativeBlobUtil.fs.writeFile(file, contents, 'utf8');

      await useLanguageStore.getState().load();

      expect(useLanguageStore.getState().language).toBe('en');
      expect(useLanguageStore.getState().loaded).toBe(true);
    },
  );

  it('saves the chosen language for the next launch', async () => {
    useLanguageStore.getState().setLanguage('en');
    await new Promise((resolve) => setImmediate(resolve));

    expect(useLanguageStore.getState().language).toBe('en');
    useLanguageStore.setState({ language: 'es' });
    await useLanguageStore.getState().load();
    expect(useLanguageStore.getState().language).toBe('en');
  });

  it('keeps the new language for the session when the write fails', async () => {
    jest.spyOn(ReactNativeBlobUtil.fs, 'writeFile').mockRejectedValue(new Error('disk full'));

    useLanguageStore.getState().setLanguage('en');
    await new Promise((resolve) => setImmediate(resolve));

    expect(useLanguageStore.getState().language).toBe('en');
  });
});
