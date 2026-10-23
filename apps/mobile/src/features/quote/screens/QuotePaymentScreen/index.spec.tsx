import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { useQuoteStore } from '../../store/useQuoteStore';
import { es as texts } from '../../texts/es';
import { OfertaCotizacion, ProductoMovil } from '../../types';
import { formatVigenteHasta, quoteReference } from '../../utils';
import QuotePaymentScreen from './index';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  const goBack = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      goBack,
      canGoBack: () => true,
    }),
    useIsFocused: () => true,
  };
});

function vigenteHastaHoy(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59:59-05:00`;
}

const VIAJE: ProductoMovil = {
  id: 'viaje-internacional',
  nombre: 'Viaje Internacional',
  descripcion: 'Gastos médicos, equipaje y asistencia en viaje',
  precio_desde: '120000',
  disponible: true,
  coberturas: [],
};

const OFERTA: OfertaCotizacion = {
  id: 'oferta-1',
  producto_id: 'viaje-internacional',
  prima: '149940.00',
  coberturas: [],
  vigencia_propuesta: { desde: '2026-10-10', hasta: '2026-10-24' },
  vigente_hasta: vigenteHastaHoy(),
  version_reglas: '2026.10.0',
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function cuerpo(callIndex = 0): { intento_id?: string; simulacion?: string } {
  const [, request] = jest.mocked(fetch).mock.calls[callIndex];
  return JSON.parse(String(request?.body)) as { intento_id?: string; simulacion?: string };
}

function seedQuote() {
  useQuoteStore.getState().selectProduct(VIAJE);
  useQuoteStore.getState().setOferta(OFERTA);
}

describe('QuotePaymentScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    useNavigation().goBack.mockClear();
    useQuoteStore.getState().clear();
    seedQuote();
    global.fetch = jest.fn(async () => jsonResponse({})) as typeof fetch;
  });

  it('shows the quote amount and the demo card alias', async () => {
    const { getByText } = await render(<QuotePaymentScreen />);

    expect(getByText('Viaje Internacional')).toBeTruthy();
    expect(
      getByText(
        texts.payment.reference(quoteReference(OFERTA.id), formatVigenteHasta(OFERTA.vigente_hasta)),
      ),
    ).toBeTruthy();
    expect(getByText(/Vigente hasta hoy 23:59/)).toBeTruthy();
    expect(getByText('Valor a cobrar')).toBeTruthy();
    expect(getByText('$149.940')).toBeTruthy();
    expect(getByText('Tarjeta terminada en 4242')).toBeTruthy();
    expect(getByText('Pagar $149.940')).toBeTruthy();
    expect(getByText('Simular pago rechazado')).toBeTruthy();
    expect(getByText('Simular cotización vencida')).toBeTruthy();
  });

  it('disables a second submit while the payment is processing', async () => {
    let release: (value: ReturnType<typeof jsonResponse>) => void = () => undefined;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    ) as typeof fetch;
    const { getByTestId, getByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByTestId('quote-pay'));
    await fireEvent.press(getByTestId('quote-pay'));

    await waitFor(() => expect(getByText('Pago procesándose...')).toBeTruthy());
    expect(getByTestId('quote-pay').props.disabled).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cuerpo().intento_id).toEqual(expect.any(String));
    expect(cuerpo().simulacion).toBeUndefined();
    expect(String(jest.mocked(fetch).mock.calls[0][0])).toContain('/movil/cotizaciones/oferta-1/pagos');

    release(
      jsonResponse({
        id: 'cobro-1',
        cotizacion_id: 'oferta-1',
        estado: 'aprobado',
        monto: '149940.00',
        moneda: 'COP',
      }),
    );
    await waitFor(() => expect(getByText(texts.payment.approved)).toBeTruthy());
    expect(getByText('Pago aprobado. El seguro está listo para continuar con la emisión.')).toBeTruthy();
  });

  it('confirms an approved payment without inventing a policy', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'cobro-1', cotizacion_id: 'oferta-1', estado: 'aprobado', monto: '1.00', moneda: 'COP' }),
    ) as typeof fetch;
    const { getByText, queryByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(texts.payment.approved)).toBeTruthy());
    expect(getByText('$149.940')).toBeTruthy();
    expect(queryByText('Pagar $149.940')).toBeNull();
    expect(queryByText(texts.payment.retry)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(queryByText('Ver mi póliza')).toBeNull();
    expect(queryByText(/SLV-/)).toBeNull();
    expect(queryByText('ACTIVA')).toBeNull();
    expect(queryByText('Tu póliza fue emitida y tu seguro ya está activo')).toBeNull();
  });

  it('shows the rejection copy and does not present a policy', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'cobro-1', cotizacion_id: 'oferta-1', estado: 'rechazado', monto: '149940.00', moneda: 'COP' }),
    ) as typeof fetch;
    const { getByText, queryByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Simular pago rechazado'));
    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(texts.payment.rejected)).toBeTruthy());
    expect(getByText(texts.payment.retry)).toBeTruthy();
    expect(getByText(texts.payment.requote)).toBeTruthy();
    expect(queryByText('Pagar $149.940')).toBeNull();
    expect(queryByText(/[Pp]óliza SLV/)).toBeNull();
    expect(queryByText('Ver mi póliza')).toBeNull();
    expect(cuerpo()).toEqual({ intento_id: expect.any(String), simulacion: 'rechazado' });
  });

  it('starts a new attempt after rejection and clears the rejection simulation', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ id: 'cobro-1', cotizacion_id: 'oferta-1', estado: 'rechazado', monto: '149940.00', moneda: 'COP' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: 'cobro-1', cotizacion_id: 'oferta-1', estado: 'aprobado', monto: '149940.00', moneda: 'COP' }),
      ) as typeof fetch;
    const { getByText, queryByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Simular pago rechazado'));
    await fireEvent.press(getByText('Pagar $149.940'));
    await waitFor(() => expect(getByText(texts.payment.rejected)).toBeTruthy());
    const primerIntento = cuerpo(0).intento_id;

    await fireEvent.press(getByText(texts.payment.retry));
    expect(queryByText(texts.payment.rejected)).toBeNull();
    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(texts.payment.approved)).toBeTruthy());
    expect(cuerpo(1).intento_id).toEqual(expect.any(String));
    expect(cuerpo(1).intento_id).not.toBe(primerIntento);
    expect(cuerpo(1).simulacion).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reuses the attempt id when the same payment fails ambiguously', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'Pasarela de pagos no disponible' }, 503))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'cobro-1', cotizacion_id: 'oferta-1', estado: 'aprobado', monto: '149940.00', moneda: 'COP' }),
      ) as typeof fetch;
    const { getByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Pagar $149.940'));
    await waitFor(() => expect(getByText('Pasarela de pagos no disponible')).toBeTruthy());
    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(texts.payment.approved)).toBeTruthy());
    expect(cuerpo(0).intento_id).toBe(cuerpo(1).intento_id);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shows the expired quote message and starts a new quote', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        {
          detail: {
            codigo: 'cotizacion_vencida',
            mensaje: texts.payment.expired,
          },
        },
        409,
      ),
    ) as typeof fetch;
    const { getByText, queryByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Simular cotización vencida'));
    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(texts.payment.expired)).toBeTruthy());
    expect(queryByText('Pagar $149.940')).toBeNull();

    await fireEvent.press(getByText('Volver a cotizar'));

    expect(useQuoteStore.getState().oferta).toBeNull();
    expect(useQuoteStore.getState().product?.id).toBe(VIAJE.id);
    expect(useNavigation().navigate).toHaveBeenCalledWith('Quote', { screen: 'Form' });
  });
});
