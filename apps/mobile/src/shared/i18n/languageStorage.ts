import ReactNativeBlobUtil from 'react-native-blob-util';

import { toLanguage, type Language } from './language';

const path = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/language.json`;

export async function readLanguage(): Promise<Language | null> {
  if (!(await ReactNativeBlobUtil.fs.exists(path))) {
    return null;
  }
  const contents = await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
  return toLanguage((JSON.parse(contents) as { language?: unknown } | null)?.language);
}

export async function writeLanguage(language: Language): Promise<void> {
  await ReactNativeBlobUtil.fs.writeFile(path, JSON.stringify({ language }), 'utf8');
}
