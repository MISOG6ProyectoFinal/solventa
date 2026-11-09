import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { ApiError } from '../../../../shared/api/client';
import { applyRenewal } from '../../api/applyRenewal';
import { getRenewalOffer } from '../../api/getRenewalOffer';
import { payRenewal } from '../../api/payRenewal';
import { es as texts } from '../../texts/es';
import { RenewalOffer, RenewalResult } from '../../types';
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

jest.mock('../../api/applyRenewal', () => ({
  applyRenewal: jest.fn(),
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

const CONFIRMADA: RenewalResult = {
  poliza_id: 'poliza-1',
  numero_poliza: 'POL-75885ABCDE',
  producto_id: 'viaje-internacional',
  estado: 'aplicada',
  cobro_id: 'cobro-1',
  vigencia_anterior: { desde: '2026-01-01', hasta: '2026-12-31' },
  vigencia_nueva: { desde: '2027-01-01', hasta: '2027-12-31' },
  coberturas: [{ id: 'medicos', nombre: 'Gastos médicos en el exterior' }],
};

const PAGO_APROBADO = {
  id: 'cobro-1',
  poliza_id: 'poliza-1',
  estado: 'aprobado' as const,
  monto: '200000.00',
  moneda: 'COP',
};

function renderPayment() {
  return render(<RenewalPaymentScreen route={{ params: { policyId: 'poliza-1', productName: 'Viaje Internacional' } }} />);
}

describe('RenewalPaymentScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    jest.mocked(getRenewalOffer).mockReset();
    jest.mocked(payRenewal).mockReset();
    jest.mocked(applyRenewal).mockReset();
    jest.mocked(getRenewalOffer).mockResolvedValue(OFERTA);
    jest.mocked(applyRenewal).mockResolvedValue(CONFIRMADA);
  });

  it('confirms the proposed premium before charging and does not send the amount', async () => {
    let resolvePay: (value: unknown) => void = () => undefined;
    jest.mocked(payRenewal).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePay = resolve;
        }),
    );
    const { findByTestId, getByTestId, getByText, queryByText } = await renderPayment();

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

    let resolveApply: (value: RenewalResult) => void = () => undefined;
    jest.mocked(applyRenewal).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApply = resolve;
        }),
    );

    await act(async () => {
      resolvePay(PAGO_APROBADO);
    });

    expect(getByText(texts.renewal.applying)).toBeTruthy();
    expect(applyRenewal).toHaveBeenCalledTimes(1);
    expect(applyRenewal).toHaveBeenCalledWith('poliza-1', 'cobro-1');
    expect(payRenewal).toHaveBeenCalledTimes(1);
    expect(queryByText(texts.renewal.successAlert)).toBeNull();

    await act(async () => {
      resolveApply(CONFIRMADA);
    });
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
    expect(applyRenewal).not.toHaveBeenCalled();
    expect(useNavigation().navigate).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('renewal-pay'));

    await waitFor(() => expect(payRenewal).toHaveBeenCalledTimes(2));
    expect(jest.mocked(payRenewal).mock.calls[1][1]).not.toBe(jest.mocked(payRenewal).mock.calls[0][1]);
    expect(jest.mocked(payRenewal).mock.calls[0]).toEqual(['poliza-1', expect.any(String), undefined]);
  });

  it('shows the new term from the applied renewal and opens the policy', async () => {
    jest.mocked(payRenewal).mockResolvedValue(PAGO_APROBADO);
    const { findByText, getByTestId, getByText, queryByText } = await renderPayment();

    await fireEvent.press(await findByText(texts.renewal.pay('$200.000')));

    expect(await findByText(texts.renewal.successAlert)).toBeTruthy();
    expect(getByText(texts.renewal.successTitle)).toBeTruthy();
    expect(getByTestId('renewal-new-start').props.children).toBe(texts.renewal.newStart('2027-01-01'));
    expect(getByTestId('renewal-new-end').props.children).toBe(texts.renewal.newEnd('2027-12-31'));
    expect(getByText('Gastos médicos en el exterior')).toBeTruthy();
    expect(queryByText(texts.renewal.newStart('2026-10-25'))).toBeNull();
    expect(queryByText(texts.renewal.pay('$200.000'))).toBeNull();
    expect(payRenewal).toHaveBeenCalledTimes(1);
    expect(applyRenewal).toHaveBeenCalledTimes(1);
    expect(applyRenewal).toHaveBeenCalledWith('poliza-1', 'cobro-1');

    await fireEvent.press(getByTestId('renewal-view-policy'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('PolicyDetail', {
      policy: expect.objectContaining({
        id: 'poliza-1',
        numero: 'POL-75885ABCDE',
        renovable: false,
        vigencia: CONFIRMADA.vigencia_anterior,
        renovacion: {
          estado: 'aplicada',
          cobro_id: 'cobro-1',
          vigencia_nueva: CONFIRMADA.vigencia_nueva,
        },
      }),
      productName: 'Viaje Internacional',
    });
  });

  it('retries the same approved payment without charging again', async () => {
    jest.mocked(payRenewal).mockResolvedValue(PAGO_APROBADO);
    jest.mocked(applyRenewal).mockRejectedValueOnce(new ApiError(503, 'Pólizas no disponible'));
    const { findByText, getByTestId, queryByText } = await renderPayment();

    await fireEvent.press(await findByText(texts.renewal.pay('$200.000')));

    expect(await findByText(texts.renewal.applyFailed)).toBeTruthy();
    expect(queryByText(texts.renewal.successAlert)).toBeNull();
    expect(queryByText(texts.renewal.pay('$200.000'))).toBeNull();
    expect(getByTestId('renewal-apply-retry')).toBeTruthy();

    await fireEvent.press(getByTestId('renewal-apply-retry'));

    expect(await findByText(texts.renewal.successAlert)).toBeTruthy();
    expect(payRenewal).toHaveBeenCalledTimes(1);
    expect(applyRenewal).toHaveBeenCalledTimes(2);
    expect(jest.mocked(applyRenewal).mock.calls[0]).toEqual(['poliza-1', 'cobro-1']);
    expect(jest.mocked(applyRenewal).mock.calls[1]).toEqual(['poliza-1', 'cobro-1']);
  });

  it('reuses the same attempt when a technical error is retried', async () => {
    jest.mocked(payRenewal).mockRejectedValue(new ApiError(503, 'Pasarela de pagos no disponible'));
    const { findByText, getByTestId } = await renderPayment();

    await fireEvent.press(await findByText(texts.renewal.pay('$200.000')));

    expect(await findByText('Pasarela de pagos no disponible')).toBeTruthy();
    expect(getByTestId('renewal-payment-retry')).toBeTruthy();
    expect(applyRenewal).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('renewal-payment-retry'));

    await waitFor(() => expect(payRenewal).toHaveBeenCalledTimes(2));
    expect(jest.mocked(payRenewal).mock.calls[1][1]).toBe(jest.mocked(payRenewal).mock.calls[0][1]);
    expect(useNavigation().navigate).not.toHaveBeenCalled();
  });
});
