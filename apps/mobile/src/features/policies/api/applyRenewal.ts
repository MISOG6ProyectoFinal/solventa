import { apiClient } from '../../../shared/api/client';
import { RenewalResult } from '../types';

export function applyRenewal(policyId: string, paymentId: string): Promise<RenewalResult> {
  return apiClient.post(`/movil/polizas/${encodeURIComponent(policyId)}/renovaciones`, {
    cobro_id: paymentId,
  });
}
