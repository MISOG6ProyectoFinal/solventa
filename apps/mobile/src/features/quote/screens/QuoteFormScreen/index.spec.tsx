import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { useLanguageStore } from '../../../../shared/i18n/useLanguageStore';
import { useQuoteStore } from '../../store/useQuoteStore';
import { ProductoMovil } from '../../types';
import { toApiDate } from '../../../../shared/date';
import { defaultQuoteForm } from '../../utils';
import QuoteFormScreen from './index';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  const goBack = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      goBack,
      canGoBack: () => true,
    }),
  };
});

const VIAJE: ProductoMovil = {
  id: 'viaje-internacional',
  nombre: 'Viaje Internacional',
  descripcion: 'Gastos médicos, equipaje y asistencia en viaje',
  precio_desde: '120000',
  disponible: true,
  coberturas: [],
};

const OFERTA = {
  id: 'oferta-1',
  producto_id: 'viaje-internacional',
  prima: '149940.00',
  coberturas: [
    { id: 'viaje-gastos-medicos', nombre: 'Gastos médicos en el exterior' },
    { id: 'viaje-cancelacion', nombre: 'Cancelación de viaje' },
    { id: 'viaje-equipaje', nombre: 'Pérdida de equipaje' },
    { id: 'viaje-asistencia', nombre: 'Asistencia en viaje' },
  ],
  vigencia_propuesta: { desde: '2026-10-10', hasta: '2026-10-24' },
  vigente_hasta: '2026-10-19T23:59:59-05:00',
  version_reglas: '2026.10.0',
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const CONTRACT = {
  properties: { destino: { enum: ['Estados Unidos', 'España', 'México', 'Otro país'] } },
};

function routeFetch(quote: () => unknown) {
  return jest.fn(async (url: unknown) => (String(url).endsWith('/contrato') ? jsonResponse(CONTRACT) : quote()));
}

function quoteCalls() {
  return jest.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/movil/cotizaciones'));
}

function seedViaje() {
  useQuoteStore.getState().selectProduct(VIAJE);
}

describe('QuoteFormScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    useNavigation().goBack.mockClear();
    useQuoteStore.getState().clear();
    seedViaje();
    global.fetch = routeFetch(() => jsonResponse(OFERTA)) as unknown as typeof fetch;
  });

  it('shows the viaje form with the prototype defaults', async () => {
    const defaults = defaultQuoteForm();
    const { findByText, getByText, getByDisplayValue, queryByText } = await render(<QuoteFormScreen />);

    expect(await findByText('Estados Unidos')).toBeTruthy();
    expect(getByText('Comprar seguro')).toBeTruthy();
    expect(getByText('Cotiza y activa tu cobertura')).toBeTruthy();
    expect(getByText('Viaje Internacional')).toBeTruthy();
    expect(getByText('Gastos médicos, equipaje y asistencia en viaje')).toBeTruthy();
    expect(getByText(/Nombre completo/)).toBeTruthy();
    expect(getByDisplayValue('María Rodríguez')).toBeTruthy();
    expect(getByText(/Cédula/)).toBeTruthy();
    expect(getByDisplayValue('1020304050')).toBeTruthy();
    expect(getByText(/Destino/)).toBeTruthy();
    expect(getByText(/Fecha de salida/)).toBeTruthy();
    expect(getByText(defaults.fechaSalida)).toBeTruthy();
    expect(getByText(/Fecha de regreso/)).toBeTruthy();
    expect(getByText(defaults.fechaRegreso)).toBeTruthy();
    expect(getByText(/Número de viajeros/)).toBeTruthy();
    expect(getByDisplayValue('1')).toBeTruthy();
    expect(getByText('Calcular cotización')).toBeTruthy();
    expect(queryByText('Obligatorio')).toBeNull();
    expect(queryByText('Continuar')).toBeNull();

    await fireEvent.press(getByText('Estados Unidos'));
    expect(getByText('España')).toBeTruthy();
    expect(getByText('México')).toBeTruthy();
    expect(getByText('Otro país')).toBeTruthy();
  });

  it('does not post when the form is invalid', async () => {
    const { findByText, getAllByText, getByDisplayValue, getByText } = await render(<QuoteFormScreen />);

    await findByText('Estados Unidos');
    await fireEvent.changeText(getByDisplayValue('María Rodríguez'), '');
    await fireEvent.changeText(getByDisplayValue('1020304050'), '');
    await fireEvent.changeText(getByDisplayValue('1'), '0');
    await fireEvent.press(getByText('Calcular cotización'));

    expect(getAllByText('Obligatorio').length).toBeGreaterThanOrEqual(2);
    expect(getByText('Debe ser un número mayor a 0')).toBeTruthy();
    expect(quoteCalls()).toHaveLength(0);
    expect(useNavigation().navigate).not.toHaveBeenCalled();
  });

  it('shows validation errors in the current language and follows a language change', async () => {
    const { getByDisplayValue, getByText, queryByText } = await render(<QuoteFormScreen />);

    await fireEvent.changeText(getByDisplayValue('1'), '0');
    await fireEvent.press(getByText('Calcular cotización'));
    expect(getByText('Debe ser un número mayor a 0')).toBeTruthy();

    await act(async () => {
      useLanguageStore.setState({ language: 'en' });
    });

    expect(getByText('Must be greater than 0')).toBeTruthy();
    expect(queryByText('Debe ser un número mayor a 0')).toBeNull();
  });

  it('posts the exact viaje payload and opens the result', async () => {
    const defaults = defaultQuoteForm();
    const { findByText, getByText } = await render(<QuoteFormScreen />);

    await findByText('Estados Unidos');
    await fireEvent.press(getByText('Calcular cotización'));

    await waitFor(() => {
      expect(useNavigation().navigate).toHaveBeenCalledWith('Quote', { screen: 'Result' });
    });

    expect(quoteCalls()).toHaveLength(1);
    const [url, init] = quoteCalls()[0];
    expect(String(url)).toMatch(/\/movil\/cotizaciones$/);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'es' },
      body: JSON.stringify({
        producto_id: 'viaje-internacional',
        nombre: 'María Rodríguez',
        cedula: '1020304050',
        destino: 'Estados Unidos',
        fecha_salida: toApiDate(defaults.fechaSalida),
        fecha_regreso: toApiDate(defaults.fechaRegreso),
        viajeros: 1,
      }),
    });
    expect(useQuoteStore.getState().oferta?.prima).toBe('149940.00');
  });

  it('shows the calculating state and blocks a second submit', async () => {
    let release: (value: unknown) => void = () => undefined;
    global.fetch = routeFetch(
      () =>
        new Promise((resolve) => {
          release = () => resolve(jsonResponse(OFERTA));
        }),
    ) as unknown as typeof fetch;

    const { findByText, getByText, getByTestId, queryByText, queryByTestId } = await render(<QuoteFormScreen />);

    await findByText('Estados Unidos');
    await fireEvent.press(getByText('Calcular cotización'));

    expect(getByText('Calculando cotización...')).toBeTruthy();
    expect(getByTestId('quote-loading')).toBeTruthy();
    expect(queryByText('Calcular cotización')).toBeNull();
    expect(queryByTestId('quote-calc')).toBeNull();

    await fireEvent.press(getByText('Calculando cotización...'));
    expect(quoteCalls()).toHaveLength(1);

    release(undefined);

    await waitFor(() => {
      expect(useNavigation().navigate).toHaveBeenCalledWith('Quote', { screen: 'Result' });
    });
  });

  it('keeps the form open when the backend rejects the quote', async () => {
    global.fetch = routeFetch(() =>
      jsonResponse({ detail: 'Producto no ofrecido en el canal: proteccion-celular' }, 422),
    ) as unknown as typeof fetch;
    const { findByText, getByText, queryByTestId } = await render(<QuoteFormScreen />);

    await findByText('Estados Unidos');
    await fireEvent.press(getByText('Calcular cotización'));

    expect(await findByText('Producto no ofrecido en el canal: proteccion-celular')).toBeTruthy();
    expect(queryByTestId('quote-loading')).toBeNull();
    expect(getByText('Calcular cotización')).toBeTruthy();
    expect(useNavigation().navigate).not.toHaveBeenCalled();
  });

  it('shows the generic quote error when the API has no detail', async () => {
    global.fetch = routeFetch(() => jsonResponse({}, 500)) as unknown as typeof fetch;
    const { findByText, getByText } = await render(<QuoteFormScreen />);

    await findByText('Estados Unidos');
    await fireEvent.press(getByText('Calcular cotización'));

    expect(await findByText('No se pudo calcular la cotización.')).toBeTruthy();
  });

  it('tells the traveler when the form options cannot be loaded', async () => {
    global.fetch = jest.fn(async () => jsonResponse({}, 503)) as unknown as typeof fetch;

    const { findByText } = await render(<QuoteFormScreen />);

    expect(await findByText('No se pudieron cargar las opciones del formulario.')).toBeTruthy();
  });
});
