import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { es as texts } from '../../texts/es';
import { daysUntil } from '../../utils';
import PolicyDetailScreen from './index';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      goBack: jest.fn(),
      canGoBack: () => true,
    }),
  };
});

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
    const { getByText, queryByTestId, queryByText } = await render(
      <PolicyDetailScreen route={{ params: { policy: { ...POLIZA, renovable: false } } }} />,
    );

    expect(getByText('POL-75885ABCDE')).toBeTruthy();
    expect(queryByTestId('policy-renewal-offer-button')).toBeNull();
    expect(queryByText(texts.policies.seeRenewalOffer)).toBeNull();
  });
});
