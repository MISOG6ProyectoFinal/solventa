import { fromApiDate, isPastDate, toApiDate, toDisplayDate } from './date';

describe('date helpers', () => {
  it('converts dates without shifting a day through UTC', () => {
    expect(toApiDate('10/10/2026')).toBe('2026-10-10');
    expect(fromApiDate('2026-10-24')).toBe('24/10/2026');
    expect(toDisplayDate(new Date(2026, 9, 10))).toBe('10/10/2026');
  });

  it('tells whether a date is before today', () => {
    const today = new Date(2026, 9, 25);

    expect(isPastDate('24/10/2026', today)).toBe(true);
    expect(isPastDate('25/10/2026', today)).toBe(false);
    expect(isPastDate('26/10/2026', today)).toBe(false);
    expect(isPastDate('01/01/1990', today)).toBe(true);
  });
});
