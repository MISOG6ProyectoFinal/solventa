import { Policy } from '../../../core/models/policy.model';
import { daysBetween } from '../../../shared/utils/date.utils';
import { NON_REFUNDABLE_CAUSE } from '../constants/ops.constants';

export interface CancellationQuote {
  readonly termDays: number;
  readonly unearnedDays: number;
  readonly refund: number;
}

/** Calcula la prima no devengada que se devuelve al cancelar una póliza. */
export function calculateCancellation(policy: Policy, cause: string, today: string): CancellationQuote {
  const termDays = Math.max(1, daysBetween(policy.startDate, policy.endDate));
  const unearnedDays = Math.max(0, daysBetween(today, policy.endDate));
  const refund = cause === NON_REFUNDABLE_CAUSE ? 0 : Math.round((policy.premium * unearnedDays) / termDays);

  return { termDays, unearnedDays, refund };
}
