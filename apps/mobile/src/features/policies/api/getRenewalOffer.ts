import { apiClient } from '../../../shared/api/client';
import { RenewalOffer } from '../types';

export function getRenewalOffer(policyId: string): Promise<RenewalOffer> {
  return apiClient.get(`/movil/polizas/${encodeURIComponent(policyId)}/renovacion/oferta`);
}
