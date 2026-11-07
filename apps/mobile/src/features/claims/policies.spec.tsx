import { renderHook, waitFor } from '@testing-library/react-native';

import { listPolicies } from '../policies/api/listPolicies';
import { Policy } from '../policies/types';
import { getProducts } from '../quote/api/getProducts';
import { useClaimPolicies, usePolicyNumber } from './policies';

jest.mock('../policies/api/listPolicies', () => ({
  listPolicies: jest.fn(),
}));

jest.mock('../quote/api/getProducts', () => ({
  getProducts: jest.fn(),
}));

const ACTIVE: Policy = {
  id: 'poliza-1',
  numero: 'POL-75885ABCDE',
  cotizacion_id: 'oferta-1',
  cobro_id: 'cobro-1',
  producto_id: 'viaje-internacional',
  prima: '149940.00',
  estado: 'activa',
  vigencia: { desde: '2026-10-10', hasta: '2026-12-20' },
  coberturas: [],
};

const EXPIRED: Policy = { ...ACTIVE, id: 'poliza-2', numero: 'POL-00000BBBBB', estado: 'vencida' };

describe('claim policies', () => {
  beforeEach(() => {
    jest.mocked(listPolicies).mockReset();
    jest.mocked(getProducts).mockReset();
  });

  it('offers only active policies, labeled with the product name and number', async () => {
    jest.mocked(listPolicies).mockResolvedValue([ACTIVE, EXPIRED]);
    jest.mocked(getProducts).mockResolvedValue([
      { id: 'viaje-internacional', nombre: 'Viaje Internacional' } as never,
    ]);
    const { result } = await renderHook(() => useClaimPolicies());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual([{ value: 'poliza-1', label: 'Viaje Internacional · POL-75885ABCDE' }]);
  });

  it('falls back to the product id when the catalog is unavailable', async () => {
    jest.mocked(listPolicies).mockResolvedValue([ACTIVE]);
    jest.mocked(getProducts).mockRejectedValue(new Error('down'));
    const { result } = await renderHook(() => useClaimPolicies());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual([{ value: 'poliza-1', label: 'viaje-internacional · POL-75885ABCDE' }]);
  });

  it('offers no policies when they cannot be loaded', async () => {
    jest.mocked(listPolicies).mockRejectedValue(new Error('down'));
    jest.mocked(getProducts).mockResolvedValue([]);
    const { result } = await renderHook(() => useClaimPolicies());

    await waitFor(() => expect(result.current).toEqual([]));
  });

  it('shows the policy number and keeps unknown ids as they are', async () => {
    jest.mocked(listPolicies).mockResolvedValue([ACTIVE, EXPIRED]);
    const { result } = await renderHook(() => usePolicyNumber());

    await waitFor(() => expect(result.current('poliza-2')).toBe('POL-00000BBBBB'));
    expect(result.current('SLV-2026-03105')).toBe('SLV-2026-03105');
  });

  it('keeps the id when the policies cannot be loaded', async () => {
    jest.mocked(listPolicies).mockRejectedValue(new Error('down'));
    const { result } = await renderHook(() => usePolicyNumber());

    await waitFor(() => expect(jest.mocked(listPolicies)).toHaveBeenCalled());
    expect(result.current('poliza-1')).toBe('poliza-1');
  });
});
