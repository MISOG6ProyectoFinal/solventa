import { isValidEmail } from './email';

describe('isValidEmail', () => {
  it('accepts a plain address', () => {
    expect(isValidEmail('ana@solventa.test')).toBe(true);
    expect(isValidEmail('ana.rojas+seguros@mail.solventa.co')).toBe(true);
  });

  it('rejects text that is not an address', () => {
    for (const value of [
      '',
      'ana',
      'ana@',
      '@solventa.test',
      'ana@solventa',
      'a b@solventa.test',
      'a@@solventa.test',
      'ana@solventa..test',
      'ana@.test',
      'ana@solventa.',
    ]) {
      expect(isValidEmail(value)).toBe(false);
    }
  });

  it('answers quickly for a long input made of dots', () => {
    const start = Date.now();

    expect(isValidEmail(`a@${'.'.repeat(50_000)}`)).toBe(false);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
