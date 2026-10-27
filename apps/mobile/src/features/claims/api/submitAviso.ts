import { apiClient } from '../../../shared/api/client';
import { avisoPayload, createAviso, type NewAviso } from './createAviso';
import { type Aviso } from './listAvisos';
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
): Promise<Aviso> {
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
    const filed = await apiClient.post<Pick<Aviso, 'estado' | 'cliente_id' | 'radicado'>>(
      `/movil/siniestros/${created.id}/radicar`,
    );
    const { poliza_id, tipo, ocurrido_en, descripcion, ubicacion } = avisoPayload(fields);
    return {
      id: created.id,
      cliente_id: filed.cliente_id,
      poliza_id,
      tipo,
      ocurrido_en,
      descripcion,
      ubicacion: ubicacion ?? null,
      estado: filed.estado,
      radicado: filed.radicado,
    };
  } catch (error) {
    throw new SubmitAvisoError(true, error);
  }
}
