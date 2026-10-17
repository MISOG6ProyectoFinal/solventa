import { apiClient } from '../../../shared/api/client';
import { createAviso, type NewAviso } from './createAviso';
import { uploadEvidence, type EvidenceFile } from './uploadEvidence';

export class SubmitAvisoError extends Error {
  readonly avisoCreated: boolean;

  constructor(avisoCreated: boolean, cause: unknown) {
    super(cause instanceof Error ? cause.message : '', { cause });
    this.name = 'SubmitAvisoError';
    this.avisoCreated = avisoCreated;
  }
}

export async function submitAviso(
  aviso: NewAviso & { files: EvidenceFile[] },
): Promise<{ id: string; radicado: string }> {
  const { files, ...fields } = aviso;
  let created: { id: string };
  try {
    created = await createAviso(fields);
  } catch (error) {
    throw new SubmitAvisoError(false, error);
  }

  try {
    for (const file of files) {
      await uploadEvidence(created.id, file);
    }
    const filed = await apiClient.post<{ radicado: string }>(`/movil/siniestros/${created.id}/radicar`);
    return { id: created.id, radicado: filed.radicado };
  } catch (error) {
    throw new SubmitAvisoError(true, error);
  }
}
