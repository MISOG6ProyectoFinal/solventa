import { apiClient } from '../../../shared/api/client';

export type AssistanceService = 'grua' | 'ambulancia' | 'perito';

export type Asistencia = {
  id: string;
  aviso_id: string;
  servicio: AssistanceService;
  ubicacion: string;
  gps: string | null;
  numero: string;
  eta_min: number;
  eta_max: number;
  estado: string;
};

export async function getAssistance(avisoId: string): Promise<Asistencia | null> {
  const items = await apiClient.get<Asistencia[]>(`/movil/siniestros/${avisoId}/asistencias`);
  return items[0] ?? null;
}
