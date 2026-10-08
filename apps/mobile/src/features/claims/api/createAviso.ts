import { apiClient } from '../../../shared/api/client';
import { toIsoOccurredAt } from '../utils';

export type NewAviso = {
  policy: string;
  claimType: string;
  occurredAt: string;
  location: string;
  description: string;
};

function policyId(policy: string): string {
  const parts = policy.split(' · ');
  return parts[parts.length - 1] ?? policy;
}

export function createAviso(aviso: NewAviso): Promise<{ id: string }> {
  return apiClient.post('/movil/siniestros', {
    poliza_id: policyId(aviso.policy),
    tipo: aviso.claimType,
    ocurrido_en: toIsoOccurredAt(aviso.occurredAt),
    descripcion: aviso.description,
    ...(aviso.location === '' ? {} : { ubicacion: aviso.location }),
  });
}
