import ReactNativeBlobUtil from 'react-native-blob-util';

import { apiClient } from '../../../shared/api/client';
import { filePathOf } from '../photo';
import { readFileSize } from '../fileSize';
import { getTexts } from '../texts';

export type EvidenceFile = {
  kind: 'photo' | 'video';
  filePath: string;
  bytes: number;
};

const contentType = {
  photo: 'image/jpeg',
  video: 'video/mp4',
} as const;

type UploadTarget = {
  evidencia_id: string;
  upload_url: string;
  headers: Record<string, string>;
};

// The file streams from disk natively, so a 50 MB video never passes through JS memory.
async function putEvidence(target: UploadTarget, filePath: string) {
  const uploaded = await ReactNativeBlobUtil.fetch(
    'PUT',
    target.upload_url,
    target.headers,
    ReactNativeBlobUtil.wrap(filePathOf(filePath)),
  );
  const { status } = uploaded.info();
  if (status < 200 || status >= 300) {
    throw new Error(getTexts().report.sendFailed);
  }
}

export async function uploadEvidence(avisoId: string, file: EvidenceFile) {
  // The camera buffer and the saved file can differ in size. Declare the bytes that are uploaded.
  const target = await apiClient.post<UploadTarget>(`/movil/siniestros/${avisoId}/evidencias/cargas`, {
    content_type: contentType[file.kind],
    bytes: await readFileSize(file.filePath),
  });
  await putEvidence(target, file.filePath);
  await apiClient.post(`/movil/siniestros/${avisoId}/evidencias/${target.evidencia_id}/confirmar`);
}
