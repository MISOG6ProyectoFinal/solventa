import { apiClient } from '../../../shared/api/client';
import { toApiDate } from '../../../shared/date';
import { type RegisterValues } from '../types';
import { Session } from './startSession';

export function registerClient(values: RegisterValues): Promise<Session> {
  return apiClient.post<Session>('/movil/registros', {
    correo: values.email,
    contrasena: values.password,
    nombre: values.firstName,
    apellido: values.lastName,
    tipo_documento: values.documentType,
    numero_documento: values.documentNumber,
    telefono: values.phone,
    fecha_nacimiento: toApiDate(values.birthDate),
  });
}
