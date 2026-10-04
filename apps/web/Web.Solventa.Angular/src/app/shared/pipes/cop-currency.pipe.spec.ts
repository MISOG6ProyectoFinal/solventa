import { CopCurrencyPipe } from './cop-currency.pipe';

describe('CopCurrencyPipe', () => {
  const pipe = new CopCurrencyPipe();

  it('formats COP without decimals (es)', () => {
    const out = pipe.transform(154167, 'es');
    expect(out).toContain('154.167');
    expect(out).not.toContain(',00');
  });

  it('formats COP in English locale', () => {
    expect(pipe.transform(1500000, 'en')).toContain('1,500,000');
  });

  it('returns empty for null / undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
