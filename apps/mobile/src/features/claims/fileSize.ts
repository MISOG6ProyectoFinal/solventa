import ReactNativeBlobUtil from 'react-native-blob-util';

import { filePathOf } from './photo';

// Reads the size from the file system, so the content never passes through JS memory.
export async function readFileSize(filePath: string): Promise<number> {
  const { size } = await ReactNativeBlobUtil.fs.stat(filePathOf(filePath));
  return Number(size);
}
