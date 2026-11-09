import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { listPolicies } from '../../api/listPolicies';
import { es as texts } from '../../texts/es';
import { daysUntil } from '../../utils';
import PolicyDetailScreen from './index';

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const navigate = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      goBack: jest.fn(),
      canGoBack: () => true,
    }),
    useFocusEffect: (effect: () => undefined | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

jest.mock('../../api/listPolicies', () => ({
  listPolicies: jest.fn(),
}));

const POLIZA = {
  id: 'poliza-1',
  numero: 'POL-75885ABCDE',
  cotizacion_id: 'oferta-1',
  cobro_id: 'cobro-1',
  producto_id: 'viaje-internacional',
  prima: '149940.00',
  estado: 'activa',
  vigencia: { desde: '2026-10-10', hasta: '2026-10-24' },
  coberturas: [
    { id: 'medicos', nombre: 'Gastos médicos en el exterior' },
    { id: 'equipaje', nombre: 'Pérdida de equipaje' },
  ],
  renovable: true,
};

describe('PolicyDetailScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    jest.mocked(listPolicies).mockReset();
    jest.mocked(listPolicies).mockResolvedValue([POLIZA]);
  });

  it('shows the policy and opens the renewal offer', async () => {
    const { getByText, getByTestId } = await render(
      <PolicyDetailScreen route={{ params: { policy: POLIZA, productName: 'Viaje Internacional' } }} />,
    );

    expect(getByTestId('policy-detail-screen')).toBeTruthy();
    expect(getByText(texts.policies.detailTitle)).toBeTruthy();
    expect(getByText('Viaje Internacional')).toBeTruthy();
    expect(getByText('POL-75885ABCDE')).toBeTruthy();
    expect(getByText('ACTIVA')).toBeTruthy();
    expect(getByText('Inicio 2026-10-10')).toBeTruthy();
    expect(getByText('Fin 2026-10-24')).toBeTruthy();
    expect(getByText('Prima $149.940')).toBeTruthy();
    expect(getByText('Gastos médicos en el exterior')).toBeTruthy();
    expect(getByText('Pérdida de equipaje')).toBeTruthy();
    expect(getByText(texts.policies.renewalOfferTitle)).toBeTruthy();
    expect(getByText(texts.policies.renewalOfferBody(daysUntil('2026-10-24')))).toBeTruthy();

    fireEvent.press(getByTestId('policy-renewal-offer-button'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('RenewalOffer', {
      policyId: 'poliza-1',
      productName: 'Viaje Internacional',
    });
  });

  it('hides the renewal action when the policy is not renewable', async () => {
    const hidden = { ...POLIZA, renovable: false };
    jest.mocked(listPolicies).mockResolvedValue([hidden]);
    const { getByText, queryByTestId, queryByText } = await render(
      <PolicyDetailScreen route={{ params: { policy: hidden } }} />,
    );

    expect(getByText('POL-75885ABCDE')).toBeTruthy();
    await waitFor(() => expect(listPolicies).toHaveBeenCalled());
    expect(queryByTestId('policy-renewal-offer-button')).toBeNull();
    expect(queryByText(texts.policies.seeRenewalOffer)).toBeNull();
  });

  it('replaces a stale policy with the persisted renewal', async () => {
    const fresh = {
      ...POLIZA,
      renovable: false,
      renovacion: {
        estado: 'aplicada' as const,
        cobro_id: 'cobro-renovacion',
        vigencia_nueva: { desde: '2027-01-01', hasta: '2027-12-31' },
      },
    };
    jest.mocked(listPolicies).mockResolvedValue([fresh]);
    const { findByText, getByTestId, queryByTestId } = await render(
      <PolicyDetailScreen route={{ params: { policy: POLIZA, productName: 'Viaje Internacional' } }} />,
    );

    expect(await findByText(texts.renewal.newStart('2027-01-01'))).toBeTruthy();
    expect(await findByText(texts.renewal.newEnd('2027-12-31'))).toBeTruthy();
    expect(queryByTestId('policy-renewal-offer-button')).toBeNull();
    expect(listPolicies).toHaveBeenCalled();

    fireEvent.press(getByTestId('policy-go-home'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('Main', { screen: 'Home' });
  });
});
