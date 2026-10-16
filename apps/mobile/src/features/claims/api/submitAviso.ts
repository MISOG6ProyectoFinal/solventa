import { apiClient } from '../../../shared/api/client';
import { createAviso, type NewAviso } from './createAviso';
import { uploadEvidence, type EvidenceFile } from './uploadEvidence';

export async function submitAviso(aviso: NewAviso & { files: EvidenceFile[] }): Promise<{ id: string }> {
  const { files, ...fields } = aviso;
  const created = await createAviso(fields);
  for (const file of files) {
    await uploadEvidence(created.id, file);
  }
  await apiClient.post(`/movil/siniestros/${created.id}/radicar`);

  return created;
}
