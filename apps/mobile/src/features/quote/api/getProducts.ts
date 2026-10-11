import { apiClient } from '../../../shared/api/client';
import { ProductoMovil } from '../types';

export function getProducts(): Promise<ProductoMovil[]> {
  return apiClient.get('/movil/productos');
}
