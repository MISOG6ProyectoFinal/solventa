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

async function putEvidence(target: UploadTarget, filePath: string) {
  const file = await fetch(photoUri(filePath));
  if (!file.ok) {
    throw new Error(texts.report.sendFailed);
  }

  const uploaded = await fetch(target.upload_url, {
    method: 'PUT',
    headers: target.headers,
    body: await file.blob(),
  });
  if (!uploaded.ok) {
    throw new Error(texts.report.sendFailed);
  }
}

export async function uploadEvidence(avisoId: string, file: EvidenceFile) {
  const target = await apiClient.post<UploadTarget>(`/movil/siniestros/${avisoId}/evidencias/cargas`, {
    content_type: contentType[file.kind],
    bytes: file.bytes,
  });
  await putEvidence(target, file.filePath);
  await apiClient.post(`/movil/siniestros/${avisoId}/evidencias/${target.evidencia_id}/confirmar`);
}
