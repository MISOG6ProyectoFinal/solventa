import * as Keychain from 'react-native-keychain';

import { deleteToken, readToken, saveToken } from './storage';

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

describe('session storage', () => {
  beforeEach(() => {
    jest.mocked(Keychain.getGenericPassword).mockReset();
    jest.mocked(Keychain.setGenericPassword).mockReset();
    jest.mocked(Keychain.resetGenericPassword).mockReset();
  });

  it('returns null when the keychain has no token', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValue(false);

    await expect(readToken()).resolves.toBeNull();
  });

  it('returns the stored token', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValue({
      username: 'sesion',
      password: 'token-firmado',
      service: 'solventa.sesion',
      storage: 'keychain',
    });

    await expect(readToken()).resolves.toBe('token-firmado');
  });

  it('saves and deletes the token in the keychain', async () => {
    await saveToken('token-firmado');
    await deleteToken();

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith('sesion', 'token-firmado', {
      service: 'solventa.sesion',
    });
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({ service: 'solventa.sesion' });
  });
});
