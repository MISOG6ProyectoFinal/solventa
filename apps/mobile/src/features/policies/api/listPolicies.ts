import { apiClient } from '../../../shared/api/client';
import { Policy } from '../types';

export function listPolicies(): Promise<Policy[]> {
  return apiClient.get('/movil/polizas');
}
