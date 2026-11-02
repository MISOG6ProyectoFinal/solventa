import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { es as texts } from '../../texts/es';
import RenewalOfferScreen from './index';

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

const OFERTA = {
  poliza_id: 'poliza-1',
  numero_poliza: 'POL-75885ABCDE',
  producto_id: 'viaje-internacional',
  prima_actual: '149940.00',
  prima_propuesta: '149940.00',
  vigencia_actual: { desde: '2026-10-10', hasta: '2026-10-24' },
  vigencia_propuesta: { desde: '2026-10-25', hasta: '2026-11-08' },
  coberturas_propuestas: [
    { id: 'medicos', nombre: 'Gastos médicos en el exterior' },
    { id: 'equipaje', nombre: 'Pérdida de equipaje' },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function renderOffer(productName?: string) {
  return render(<RenewalOfferScreen route={{ params: { policyId: 'poliza-1', productName } }} />);
}

describe('RenewalOfferScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
  });
  it('shows a loading state until the offer arrives', async () => {
    let release: (value: ReturnType<typeof jsonResponse>) => void = () => undefined;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    ) as typeof fetch;
    const { findByText, getByTestId, queryByTestId, queryByText } = await renderOffer('Viaje Internacional');

    expect(getByTestId('renewal-offer-loading')).toBeTruthy();
    expect(queryByTestId('renewal-current-premium')).toBeNull();
    expect(queryByText(texts.renewal.disclaimer)).toBeNull();

    release(jsonResponse(OFERTA));

    expect(await findByText(texts.renewal.disclaimer)).toBeTruthy();
    expect(queryByTestId('renewal-offer-loading')).toBeNull();
  });

  it('shows the current premium, the proposed term and the coverages', async () => {
    global.fetch = jest.fn(async () => jsonResponse(OFERTA)) as typeof fetch;
    const { findByText, getByTestId, getByText } = await renderOffer('Viaje Internacional');

    expect(await findByText(texts.renewal.disclaimer)).toBeTruthy();
    expect(getByTestId('renewal-offer-screen')).toBeTruthy();
    expect(getByTestId('renewal-readonly-message')).toBeTruthy();
    expect(getByText('Viaje Internacional')).toBeTruthy();
    expect(getByText(texts.renewal.currentPremium)).toBeTruthy();
    expect(getByText(texts.renewal.newPremium)).toBeTruthy();
    expect(getByTestId('renewal-current-premium').props.children).toBe('$149.940');
    expect(getByTestId('renewal-proposed-premium').props.children).toBe('$149.940');
    expect(getByText(/Nueva vigencia:/)).toBeTruthy();
    expect(getByTestId('renewal-start').props.children).toBe('2026-10-25');
    expect(getByTestId('renewal-end').props.children).toBe('2026-11-08');
    expect(getByTestId('renewal-coverages')).toBeTruthy();
    expect(getByText('Gastos médicos en el exterior')).toBeTruthy();
    expect(getByText('Pérdida de equipaje')).toBeTruthy();
    expect(getByText(texts.renewal.renewNow)).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/movil\/polizas\/poliza-1\/renovacion\/oferta$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('uses the product id when the list did not pass a name', async () => {
    global.fetch = jest.fn(async () => jsonResponse(OFERTA)) as typeof fetch;
    const { findByText } = await renderOffer();

    expect(await findByText('viaje-internacional')).toBeTruthy();
  });

  it('opens the renewal payment with the policy and the product name', async () => {
    global.fetch = jest.fn(async () => jsonResponse(OFERTA)) as typeof fetch;
    const { findByTestId } = await renderOffer('Viaje Internacional');

    fireEvent.press(await findByTestId('renewal-now'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('RenewalPayment', {
      policyId: 'poliza-1',
      productName: 'Viaje Internacional',
    });
  });

  it('shows the backend error and retries the consultation', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse(
          { detail: { codigo: 'poliza_no_renovable', mensaje: 'La póliza no está habilitada para renovar.' } },
          409,
        );
      }
      return jsonResponse(OFERTA);
    }) as typeof fetch;
    const { findByText, getByText, queryByTestId } = await renderOffer('Viaje Internacional');

    expect(await findByText('La póliza no está habilitada para renovar.')).toBeTruthy();
    expect(queryByTestId('renewal-current-premium')).toBeNull();

    fireEvent.press(getByText(texts.renewal.retryButton));

    expect(await findByText(texts.renewal.disclaimer)).toBeTruthy();
    expect(calls).toBe(2);
  });
});
