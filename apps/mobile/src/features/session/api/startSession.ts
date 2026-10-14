import { apiClient } from '../../../shared/api/client';

export type Session = {
  token: string;
  cliente_id: string;
};

export function startSession(email: string, password: string): Promise<Session> {
  return apiClient.post<Session>('/movil/sesiones', { correo: email, contrasena: password });
}
