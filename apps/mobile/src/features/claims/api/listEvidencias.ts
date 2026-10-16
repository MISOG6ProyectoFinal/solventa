import { apiClient } from '../../../shared/api/client';

export type Evidencia = {
  id: string;
  url: string;
  content_type: string;
  bytes: number;
  estado: string;
  download_url: string;
};

export function listEvidencias(avisoId: string): Promise<Evidencia[]> {
  return apiClient.get(`/movil/siniestros/${avisoId}/evidencias`);
}
