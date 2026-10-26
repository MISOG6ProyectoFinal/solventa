import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { es as policyTexts } from '../../../policies/texts/es';
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

const PAGO_APROBADO = {
  id: 'cobro-1',
  cotizacion_id: 'oferta-1',
  estado: 'aprobado',
  monto: '149940.00',
  moneda: 'COP',
};

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
    { id: 'cancelacion', nombre: 'Cancelación de viaje' },
    { id: 'equipaje', nombre: 'Pérdida de equipaje' },
    { id: 'asistencia', nombre: 'Asistencia en viaje' },
  ],
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
    global.fetch = jest.fn((url: string) => {
      if (String(url).includes('/polizas')) {
        return Promise.resolve(jsonResponse(POLIZA));
      }
      return new Promise((resolve) => {
        release = resolve;
      });
    }) as typeof fetch;
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
    await waitFor(() => expect(getByText(policyTexts.policies.issued)).toBeTruthy());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('issues the policy returned by the backend after an approved payment', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/polizas')) {
        return jsonResponse({ ...POLIZA, numero: 'POL-11111AAAAA', prima: '200000.00' });
      }
      return jsonResponse({ ...PAGO_APROBADO, monto: '1.00' });
    }) as typeof fetch;
    const { getByText, queryByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(policyTexts.policies.issued)).toBeTruthy());
    expect(getByText('Póliza POL-11111AAAAA')).toBeTruthy();
    expect(getByText('ACTIVA')).toBeTruthy();
    expect(getByText('Inicio 2026-10-10')).toBeTruthy();
    expect(getByText('Fin 2026-10-24')).toBeTruthy();
    expect(getByText('Gastos médicos en el exterior')).toBeTruthy();
    expect(getByText('Cancelación de viaje')).toBeTruthy();
    expect(getByText('Pérdida de equipaje')).toBeTruthy();
    expect(getByText('Asistencia en viaje')).toBeTruthy();
    expect(getByText('Prima $200.000')).toBeTruthy();
    expect(queryByText('Pagar $149.940')).toBeNull();
    expect(queryByText('$149.940')).toBeNull();
    const emision = jest.mocked(fetch).mock.calls.find((call) => String(call[0]).includes('/polizas'));
    expect(String(emision?.[0])).toContain('/movil/cotizaciones/oferta-1/polizas');
    expect(JSON.parse(String(emision?.[1]?.body))).toEqual({ cobro_id: 'cobro-1' });
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
    expect(queryByText(/Póliza POL-/)).toBeNull();
    expect(queryByText('Ver mi póliza')).toBeNull();
    expect(queryByText('ACTIVA')).toBeNull();
    expect(cuerpo()).toEqual({ intento_id: expect.any(String), simulacion: 'rechazado' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(jest.mocked(fetch).mock.calls[0][0])).not.toContain('/polizas');
  });

  it('starts a new attempt after rejection and clears the rejection simulation', async () => {
    let payments = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/polizas')) {
        return jsonResponse(POLIZA);
      }
      payments += 1;
      if (payments === 1) {
        return jsonResponse({
          id: 'cobro-1',
          cotizacion_id: 'oferta-1',
          estado: 'rechazado',
          monto: '149940.00',
          moneda: 'COP',
        });
      }
      return jsonResponse(PAGO_APROBADO);
    }) as typeof fetch;
    const { getByText, queryByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Simular pago rechazado'));
    await fireEvent.press(getByText('Pagar $149.940'));
    await waitFor(() => expect(getByText(texts.payment.rejected)).toBeTruthy());
    const primerIntento = cuerpo(0).intento_id;

    await fireEvent.press(getByText(texts.payment.retry));
    expect(queryByText(texts.payment.rejected)).toBeNull();
    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(policyTexts.policies.issued)).toBeTruthy());
    expect(cuerpo(1).intento_id).toEqual(expect.any(String));
    expect(cuerpo(1).intento_id).not.toBe(primerIntento);
    expect(cuerpo(1).simulacion).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('reuses the attempt id when the same payment fails ambiguously', async () => {
    let payments = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/polizas')) {
        return jsonResponse(POLIZA);
      }
      payments += 1;
      if (payments === 1) {
        return jsonResponse({ detail: 'Pasarela de pagos no disponible' }, 503);
      }
      return jsonResponse(PAGO_APROBADO);
    }) as typeof fetch;
    const { getByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Pagar $149.940'));
    await waitFor(() => expect(getByText('Pasarela de pagos no disponible')).toBeTruthy());
    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(policyTexts.policies.issued)).toBeTruthy());
    expect(cuerpo(0).intento_id).toBe(cuerpo(1).intento_id);
    expect(fetch).toHaveBeenCalledTimes(3);
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
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('opens the policies tab from the issued policy', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/polizas')) {
        return jsonResponse(POLIZA);
      }
      return jsonResponse(PAGO_APROBADO);
    }) as typeof fetch;
    const { getByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Pagar $149.940'));
    await waitFor(() => expect(getByText('Ver mi póliza')).toBeTruthy());
    await fireEvent.press(getByText('Ver mi póliza'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('Main', { screen: 'Policies' });
  });

  it('shows the failed issuance copy and does not confirm an active policy', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/polizas')) {
        return jsonResponse(
          { detail: { codigo: 'pago_no_aprobado', mensaje: policyTexts.policies.issueFailed } },
          409,
        );
      }
      return jsonResponse(PAGO_APROBADO);
    }) as typeof fetch;
    const { getByText, queryByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(policyTexts.policies.issueFailed)).toBeTruthy());
    expect(queryByText(policyTexts.policies.issued)).toBeNull();
    expect(queryByText('ACTIVA')).toBeNull();
    expect(queryByText('Ver mi póliza')).toBeNull();
    expect(queryByText(POLIZA.numero)).toBeNull();
    const emision = jest.mocked(fetch).mock.calls.find((call) => String(call[0]).includes('/polizas'));
    expect(JSON.parse(String(emision?.[1]?.body))).toEqual({ cobro_id: 'cobro-1' });
    expect(cuerpo(0)).toEqual({ intento_id: expect.any(String) });
  });

  it('does not issue when the payment stays processing', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ ...PAGO_APROBADO, estado: 'procesando' }),
    ) as typeof fetch;
    const { getByText, queryByText } = await render(<QuotePaymentScreen />);

    await fireEvent.press(getByText('Pagar $149.940'));

    await waitFor(() => expect(getByText(texts.payment.failed)).toBeTruthy());
    expect(queryByText('ACTIVA')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(jest.mocked(fetch).mock.calls[0][0])).not.toContain('/polizas');
  });
});
