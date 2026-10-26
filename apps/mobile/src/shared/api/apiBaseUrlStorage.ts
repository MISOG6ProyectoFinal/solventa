import ReactNativeBlobUtil from 'react-native-blob-util';

const path = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/api-base-url.json`;

// `cloud` is a legacy value written by older builds. It is never selected again.
export type StoredApiBaseUrl = { target: 'build' | 'custom' | 'cloud'; customUrl: string };

export async function readApiBaseUrl(): Promise<StoredApiBaseUrl | null> {
  if (!(await ReactNativeBlobUtil.fs.exists(path))) {
    return null;
  }
  const contents = await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
  return typeof contents === 'string' ? (JSON.parse(contents) as StoredApiBaseUrl) : null;
}

export function writeApiBaseUrl(value: StoredApiBaseUrl): Promise<void> {
  return ReactNativeBlobUtil.fs.writeFile(path, JSON.stringify(value), 'utf8');
}
