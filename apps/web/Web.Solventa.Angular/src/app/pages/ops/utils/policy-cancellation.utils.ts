import { Policy } from '../../../core/models/policy.model';
import { daysBetween } from '../../../shared/utils/date.utils';

export interface CancellationQuote {
  readonly termDays: number;
  readonly unearnedDays: number;
  readonly refund: number;
}

/** Calcula la prima no devengada que se devuelve al cancelar una póliza. */
export function calculateCancellation(policy: Policy, refundable: boolean, today: string): CancellationQuote {
  const termDays = Math.max(1, daysBetween(policy.startDate, policy.endDate));
  const unearnedDays = Math.max(0, daysBetween(today, policy.endDate));
  const refund = refundable ? Math.round((policy.premium * unearnedDays) / termDays) : 0;

  return { termDays, unearnedDays, refund };
}
