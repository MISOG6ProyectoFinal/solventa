import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { ApiError } from '../../../../shared/api/client';
import { issuePolicy } from '../../api/issuePolicy';
import { getRenewalOffer } from '../../api/getRenewalOffer';
import { payRenewal } from '../../api/payRenewal';
import { es as texts } from '../../texts/es';
import { RenewalOffer } from '../../types';
import RenewalPaymentScreen from './index';

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

jest.mock('../../api/getRenewalOffer', () => ({
  getRenewalOffer: jest.fn(),
}));

jest.mock('../../api/payRenewal', () => ({
  payRenewal: jest.fn(),
}));

jest.mock('../../api/issuePolicy', () => ({
  issuePolicy: jest.fn(),
}));

const OFERTA: RenewalOffer = {
  poliza_id: 'poliza-1',
  numero_poliza: 'POL-75885ABCDE',
  producto_id: 'viaje-internacional',
  prima_actual: '149940.00',
  prima_propuesta: '200000.00',
  vigencia_actual: { desde: '2026-10-10', hasta: '2026-10-24' },
  vigencia_propuesta: { desde: '2026-10-25', hasta: '2026-11-08' },
  coberturas_propuestas: [],
};

function renderPayment() {
  return render(<RenewalPaymentScreen route={{ params: { policyId: 'poliza-1', productName: 'Viaje Internacional' } }} />);
}

describe('RenewalPaymentScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    jest.mocked(getRenewalOffer).mockReset();
    jest.mocked(payRenewal).mockReset();
    jest.mocked(issuePolicy).mockReset();
    jest.mocked(getRenewalOffer).mockResolvedValue(OFERTA);
  });

  it('confirms the proposed premium before charging and does not send the amount', async () => {
    let resolvePay: (value: unknown) => void = () => undefined;
    jest.mocked(payRenewal).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePay = resolve;
        }),
    );
    const { findByTestId, getByTestId, getByText } = await renderPayment();

    expect(await findByTestId('renewal-pay-amount')).toBeTruthy();
    expect(getByTestId('renewal-pay-amount').props.children).toBe('$200.000');
    expect(getByText('Viaje Internacional · POL-75885ABCDE')).toBeTruthy();
    expect(getByText(texts.renewal.payValidity('2026-10-25', '2026-11-08'))).toBeTruthy();
    expect(getByTestId('renewal-payment-method').props.children).toBe(texts.renewal.method);
    expect(getRenewalOffer).toHaveBeenCalledWith('poliza-1');

    await act(async () => {
      fireEvent.press(getByTestId('renewal-pay'));
      fireEvent.press(getByTestId('renewal-pay'));
    });

    expect(getByTestId('renewal-payment-status')).toBeTruthy();
    expect(getByText(texts.renewal.processing)).toBeTruthy();
    expect(payRenewal).toHaveBeenCalledTimes(1);
    expect(payRenewal).toHaveBeenCalledWith('poliza-1', expect.any(String), undefined);
    expect(JSON.stringify(jest.mocked(payRenewal).mock.calls[0])).not.toContain('200000');

    await act(async () => {
      resolvePay({ id: 'cobro-1', poliza_id: 'poliza-1', estado: 'aprobado', monto: '200000.00', moneda: 'COP' });
    });

    expect(getByText(texts.renewal.approved)).toBeTruthy();
  });

  it('does not offer payment when the policy is no longer renewable', async () => {
    jest.mocked(getRenewalOffer).mockRejectedValue(new ApiError(409, 'La póliza no está habilitada para renovar.'));
    const { findByText, queryByTestId } = await renderPayment();

    expect(await findByText('La póliza no está habilitada para renovar.')).toBeTruthy();
    expect(queryByTestId('renewal-pay')).toBeNull();
    expect(queryByTestId('renewal-pay-amount')).toBeNull();
    expect(payRenewal).not.toHaveBeenCalled();
  });

  it('shows a rejected payment without renewing the policy', async () => {
    jest
      .mocked(payRenewal)
      .mockResolvedValueOnce({
        id: 'cobro-1',
        poliza_id: 'poliza-1',
        estado: 'rechazado',
        monto: '200000.00',
        moneda: 'COP',
      })
      .mockResolvedValueOnce({
        id: 'cobro-1',
        poliza_id: 'poliza-1',
        estado: 'aprobado',
        monto: '200000.00',
        moneda: 'COP',
      });
    const { findByText, getByTestId, queryByText } = await renderPayment();

    await fireEvent.press(await findByText(texts.renewal.pay('$200.000')));

    expect(await findByText(texts.renewal.rejected)).toBeTruthy();
    expect(queryByText(texts.renewal.approved)).toBeNull();
    expect(queryByText('Renovación exitosa')).toBeNull();
    expect(queryByText('Renovación exitosa. La nueva vigencia ya quedó aplicada.')).toBeNull();
    expect(issuePolicy).not.toHaveBeenCalled();
    expect(useNavigation().navigate).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('renewal-pay'));

    await waitFor(() => expect(payRenewal).toHaveBeenCalledTimes(2));
    expect(jest.mocked(payRenewal).mock.calls[1][1]).not.toBe(jest.mocked(payRenewal).mock.calls[0][1]);
    expect(jest.mocked(payRenewal).mock.calls[0]).toEqual(['poliza-1', expect.any(String), undefined]);
  });

  it('shows an approved payment without applying the new term', async () => {
    jest.mocked(payRenewal).mockResolvedValue({
      id: 'cobro-1',
      poliza_id: 'poliza-1',
      estado: 'aprobado',
      monto: '200000.00',
      moneda: 'COP',
    });
    const { findByText, getByTestId, queryByTestId, queryByText } = await renderPayment();

    await fireEvent.press(await findByText(texts.renewal.pay('$200.000')));

    expect(await findByText(texts.renewal.approved)).toBeTruthy();
    expect(getByTestId('renewal-payment-status')).toBeTruthy();
    expect(queryByText(texts.renewal.payValidity('2026-10-25', '2026-11-08'))).toBeNull();
    expect(queryByText('Renovación exitosa')).toBeNull();
    expect(queryByText('La nueva vigencia ya quedó aplicada.')).toBeNull();
    expect(queryByText('Ver póliza actualizada')).toBeNull();
    expect(queryByTestId('renewal-pay')).toBeNull();
    expect(issuePolicy).not.toHaveBeenCalled();
    expect(useNavigation().navigate).not.toHaveBeenCalled();
  });

  it('reuses the same attempt when a technical error is retried', async () => {
    jest.mocked(payRenewal).mockRejectedValue(new ApiError(503, 'Pasarela de pagos no disponible'));
    const { findByText, getByTestId } = await renderPayment();

    await fireEvent.press(await findByText(texts.renewal.pay('$200.000')));

    expect(await findByText('Pasarela de pagos no disponible')).toBeTruthy();
    expect(getByTestId('renewal-payment-retry')).toBeTruthy();
    expect(issuePolicy).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('renewal-payment-retry'));

    await waitFor(() => expect(payRenewal).toHaveBeenCalledTimes(2));
    expect(jest.mocked(payRenewal).mock.calls[1][1]).toBe(jest.mocked(payRenewal).mock.calls[0][1]);
    expect(useNavigation().navigate).not.toHaveBeenCalled();
  });
});
