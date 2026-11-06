import { initials } from './initials.utils';

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('ana gómez ruiz')).toBe('AG');
  });

  it('works with a single word', () => {
    expect(initials('Ana')).toBe('A');
  });

  it('falls back to the first letter of the fallback when there is no name', () => {
    expect(initials('  ', 'ops@solventa.co')).toBe('O');
    expect(initials('')).toBe('');
  });
});
