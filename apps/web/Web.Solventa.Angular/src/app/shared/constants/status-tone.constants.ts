import { PolicyStatus, ClaimStatus, PolicyPayment } from '../../core/models/policy.model';
import { Tone } from '../../ui/constants/design-tokens.constants';

/** Tono de `slv-badge` por estado de póliza. */
export const POLICY_STATUS_TONE: Record<PolicyStatus, Tone> = {
  Activa: 'success',
  Cancelada: 'error',
  Vencida: 'neutral',
};

/** Tono de `slv-badge` por estado de siniestro. */
export const CLAIM_STATUS_TONE: Record<ClaimStatus, Tone> = {
  Reportado: 'info',
  'En revisión': 'warning',
  Aprobado: 'success',
  Pagado: 'success',
  Rechazado: 'error',
  Cerrado: 'neutral',
};

/** Tono de `slv-badge` por estado de pago. */
export const PAYMENT_STATUS_TONE: Record<PolicyPayment['status'], Tone> = {
  Aprobado: 'success',
  Pendiente: 'warning',
  Rechazado: 'error',
};
