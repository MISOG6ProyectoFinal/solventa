import { formatDate } from './date.utils';

describe('date.utils', () => {
  describe('formatDate', () => {
    it('returns the original value when the date is not valid', () => {
      expect(formatDate('no-date')).toBe('no-date');
    });

    it('formats a valid ISO date', () => {
      expect(formatDate('2026-09-12', 'es')).toContain('2026');
    });
  });
});
