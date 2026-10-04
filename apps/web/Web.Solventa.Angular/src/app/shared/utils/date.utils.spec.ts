import { daysBetween, formatDate } from './date.utils';

describe('date.utils', () => {
  describe('daysBetween', () => {
    it('counts whole days between two ISO dates', () => {
      expect(daysBetween('2025-10-06', '2026-10-05')).toBe(364);
    });

    it('returns a negative value when the end date is earlier', () => {
      expect(daysBetween('2026-01-10', '2026-01-01')).toBe(-9);
    });
  });

  describe('formatDate', () => {
    it('returns the original value when the date is not valid', () => {
      expect(formatDate('no-date')).toBe('no-date');
    });

    it('formats a valid ISO date', () => {
      expect(formatDate('2026-09-12', 'es')).toContain('2026');
    });
  });
});
