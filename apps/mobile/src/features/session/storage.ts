import * as Keychain from 'react-native-keychain';

const SERVICE = 'solventa.sesion';

export async function readToken(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE });
  if (credentials === false) {
    return null;
  }
  return credentials.password;
}

export async function saveToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('sesion', token, { service: SERVICE });
}

export async function deleteToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
