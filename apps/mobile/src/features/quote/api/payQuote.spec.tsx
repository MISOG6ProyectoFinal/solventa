import { crearIntentoId } from './payQuote';

describe('crearIntentoId', () => {
  it('builds a short idempotency id without Math.random', () => {
    const random = jest.spyOn(Math, 'random');

    const first = crearIntentoId();
    const second = crearIntentoId();

    expect(random).not.toHaveBeenCalled();
    expect(first).toMatch(/^[0-9a-z]+-[0-9a-f]{16}$/);
    expect(first.length).toBeLessThanOrEqual(64);
    expect(second).not.toBe(first);
    random.mockRestore();
  });
});
