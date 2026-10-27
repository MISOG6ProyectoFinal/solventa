import { apiClient } from '../../../shared/api/client';
import { Policy } from '../types';

export function issuePolicy(cotizacionId: string, cobroId: string): Promise<Policy> {
  return apiClient.post(`/movil/cotizaciones/${cotizacionId}/polizas`, {
    cobro_id: cobroId,
  });
}
