import { apiClient } from '../../../shared/api/client';
import { toIsoOccurredAt } from '../utils';

export type NewAviso = {
  policy: string;
  claimType: string;
  occurredAt: string;
  location: string;
  description: string;
};

export function avisoPayload(aviso: NewAviso) {
  return {
    poliza_id: aviso.policy,
    tipo: aviso.claimType,
    ocurrido_en: toIsoOccurredAt(aviso.occurredAt),
    descripcion: aviso.description,
    ...(aviso.location === '' ? {} : { ubicacion: aviso.location }),
  };
}

export function createAviso(aviso: NewAviso): Promise<{ id: string }> {
  return apiClient.post('/movil/siniestros', avisoPayload(aviso));
}
