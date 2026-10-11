import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { useQuoteStore } from '../../store/useQuoteStore';
import { OfertaCotizacion, ProductoMovil } from '../../types';
import { quoteReference } from '../../utils';
import QuoteResultScreen from './index';

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

const OFERTA: OfertaCotizacion = {
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
  version_reglas: '2026.10.0',
};

describe('QuoteResultScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    useNavigation().goBack.mockClear();
    useQuoteStore.getState().clear();
    useQuoteStore.getState().selectProduct(VIAJE);
    useQuoteStore.getState().setOferta(OFERTA);
  });

  it('shows the quote result from the backend', async () => {
    const { getByText, queryByText } = await render(<QuoteResultScreen />);

    expect(getByText('Tu cotización')).toBeTruthy();
    expect(getByText('Cotización vigente')).toBeTruthy();
    expect(getByText('Viaje Internacional')).toBeTruthy();
    expect(getByText(`${quoteReference(OFERTA.id)} · Válida hasta hoy 23:59`)).toBeTruthy();
    expect(getByText('$149.940')).toBeTruthy();
    expect(getByText('Prima total, impuestos incluidos')).toBeTruthy();
    expect(getByText('Vigencia propuesta: 10/10/2026 a 24/10/2026')).toBeTruthy();
    expect(getByText('Gastos médicos en el exterior')).toBeTruthy();
    expect(getByText('Cancelación de viaje')).toBeTruthy();
    expect(getByText('Pérdida de equipaje')).toBeTruthy();
    expect(getByText('Asistencia en viaje')).toBeTruthy();
    expect(getByText('Continuar al pago')).toBeTruthy();
    expect(queryByText('Pago')).toBeNull();
    expect(queryByText('Valor a cobrar')).toBeNull();
    expect(queryByText('Medio de pago')).toBeNull();
  });

  it('does not start the payment flow', async () => {
    const { getByText, getByTestId } = await render(<QuoteResultScreen />);

    expect(getByTestId('quote-continue-pay').props.disabled).not.toBe(true);

    await fireEvent.press(getByText('Continuar al pago'));

    expect(useNavigation().navigate).not.toHaveBeenCalled();
    expect(useQuoteStore.getState().oferta?.id).toBe(OFERTA.id);
  });
});
