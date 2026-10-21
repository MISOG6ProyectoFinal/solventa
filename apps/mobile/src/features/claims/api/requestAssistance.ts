import { apiClient } from '../../../shared/api/client';
import { type Place } from '../../../shared/location';
import { type AssistanceService, type Asistencia } from './getAssistance';

export function requestAssistance(avisoId: string, service: AssistanceService, place: Place): Promise<Asistencia> {
  return apiClient.post(`/movil/siniestros/${avisoId}/asistencias`, {
    servicio: service,
    ubicacion: place.address,
    gps: place.gps,
  });
}
