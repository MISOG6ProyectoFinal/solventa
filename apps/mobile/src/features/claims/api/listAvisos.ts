import { apiClient } from '../../../shared/api/client';

export type Aviso = {
  id: string;
  cliente_id: string;
  poliza_id: string;
  tipo: string;
  ocurrido_en: string;
  descripcion: string;
  ubicacion: string | null;
  estado: string;
  radicado: string | null;
};

export function listAvisos(): Promise<Aviso[]> {
  return apiClient.get('/movil/siniestros');
}
