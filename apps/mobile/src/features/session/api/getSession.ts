import { apiClient } from '../../../shared/api/client';

export type ClientProfile = {
  cliente_id: string;
  correo: string;
  nombre: string;
  apellido: string;
};

export function getSession(): Promise<ClientProfile> {
  return apiClient.get('/movil/sesion');
}
