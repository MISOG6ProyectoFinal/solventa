import { formatDecimal } from './formatDecimal';

describe('formatDecimal', () => {
  it('uses a comma in Spanish and a point in English', () => {
    expect(formatDecimal(2.4, 'es')).toBe('2,4');
    expect(formatDecimal(2.4, 'en')).toBe('2.4');
  });
});
