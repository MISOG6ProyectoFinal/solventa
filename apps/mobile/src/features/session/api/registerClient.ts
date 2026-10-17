import { apiClient } from '../../../shared/api/client';

import { Session } from './startSession';

export function registerClient(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<Session> {
  return apiClient.post<Session>('/movil/registros', {
    correo: email,
    contrasena: password,
    nombre: firstName,
    apellido: lastName,
  });
}
