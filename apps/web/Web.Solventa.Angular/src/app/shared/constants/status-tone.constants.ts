import { Tone } from '../../ui/constants/design-tokens.constants';

/** Tono de `slv-badge` por estado de póliza. */
export const POLICY_STATUS_TONE: Record<string, Tone> = {
  activa: 'success',
  cancelada: 'error',
  vencida: 'neutral',
};

/** Tono de `slv-badge` por estado de siniestro. */
export const CLAIM_STATUS_TONE: Record<string, Tone> = {
  borrador: 'info',
  radicado: 'warning',
};

/** Tono de `slv-badge` por estado de pago. */
export const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  aprobado: 'success',
  procesando: 'warning',
  rechazado: 'error',
};
