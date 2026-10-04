import { OPS_POLICIES } from '../data/ops-policies.data';
import { calculateCancellation } from './policy-cancellation.utils';

describe('calculateCancellation', () => {
  const policy = OPS_POLICIES.find((p) => p.id === 'p2')!;

  it('returns a proportional refund for the unearned days', () => {
    const quote = calculateCancellation(policy, 'Retracto', '2026-09-12');

    expect(quote.termDays).toBe(364);
    expect(quote.unearnedDays).toBe(23);
    expect(quote.refund).toBe(Math.round((420000 * 23) / 364));
  });

  it('does not refund when the cause is non-payment', () => {
    expect(calculateCancellation(policy, 'Impago de prima', '2026-09-12').refund).toBe(0);
  });

  it('never returns negative unearned days after the end date', () => {
    expect(calculateCancellation(policy, 'Retracto', '2027-01-01').unearnedDays).toBe(0);
  });
});
