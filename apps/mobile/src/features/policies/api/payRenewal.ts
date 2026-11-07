import { apiClient } from '../../../shared/api/client';
import { RenewalPaymentResult, RenewalPaymentSimulation } from '../types';

export function payRenewal(
  policyId: string,
  attemptId: string,
  simulacion?: RenewalPaymentSimulation,
): Promise<RenewalPaymentResult> {
  return apiClient.post(`/movil/polizas/${encodeURIComponent(policyId)}/renovacion/pagos`, {
    intento_id: attemptId,
    ...(simulacion ? { simulacion } : {}),
  });
}
