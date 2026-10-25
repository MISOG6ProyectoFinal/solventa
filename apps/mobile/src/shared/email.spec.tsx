import { isValidEmail } from './email';

describe('isValidEmail', () => {
  it('accepts a plain address', () => {
    expect(isValidEmail('ana@solventa.test')).toBe(true);
    expect(isValidEmail('ana.rojas+seguros@mail.solventa.co')).toBe(true);
  });

  it('rejects text that is not an address', () => {
    for (const value of ['', 'ana', 'ana@', '@solventa.test', 'ana@solventa', 'a b@solventa.test', 'a@@solventa.test']) {
      expect(isValidEmail(value)).toBe(false);
    }
  });
});
