import { apiClient } from '../../../shared/api/client';
import { ProductContract } from '../types';

export function getContract(productId: string): Promise<ProductContract> {
  return apiClient.get(`/movil/productos/${encodeURIComponent(productId)}/contrato`);
}
