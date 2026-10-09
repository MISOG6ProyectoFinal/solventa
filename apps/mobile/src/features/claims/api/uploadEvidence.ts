import { apiClient } from '../../../shared/api/client';
import { photoUri } from '../photo';
import { texts } from '../texts';

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

async function readEvidence(filePath: string): Promise<Blob> {
  const file = await fetch(photoUri(filePath));
  if (!file.ok) {
    throw new Error(texts.report.sendFailed);
  }

  return file.blob();
}

async function putEvidence(target: UploadTarget, body: Blob) {
  const uploaded = await fetch(target.upload_url, {
    method: 'PUT',
    headers: target.headers,
    body,
  });
  if (!uploaded.ok) {
    throw new Error(texts.report.sendFailed);
  }
}

export async function uploadEvidence(avisoId: string, file: EvidenceFile) {
  // The camera buffer and the saved file can differ in size. Declare the bytes that are uploaded.
  const body = await readEvidence(file.filePath);
  const target = await apiClient.post<UploadTarget>(`/movil/siniestros/${avisoId}/evidencias/cargas`, {
    content_type: contentType[file.kind],
    bytes: body.size,
  });
  await putEvidence(target, body);
  await apiClient.post(`/movil/siniestros/${avisoId}/evidencias/${target.evidencia_id}/confirmar`);
}
