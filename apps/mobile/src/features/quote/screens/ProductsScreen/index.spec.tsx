import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { useQuoteStore } from '../../store/useQuoteStore';
import { ProductoMovil } from '../../types';
import ProductsScreen from './index';

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

const PRODUCTS: ProductoMovil[] = [
  {
    id: 'viaje-internacional',
    nombre: 'Viaje Internacional',
    descripcion: 'Gastos médicos, equipaje y asistencia en viaje',
    precio_desde: '120000',
    disponible: true,
    coberturas: [{ id: 'viaje-gastos-medicos', nombre: 'Gastos médicos en el exterior' }],
  },
  {
    id: 'proteccion-celular',
    nombre: 'Protección Celular',
    descripcion: 'Daño accidental, robo y líquidos',
    precio_desde: '250000',
    disponible: false,
    coberturas: [],
  },
  {
    id: 'vida-esencial',
    nombre: 'Vida Esencial',
    descripcion: 'Fallecimiento y auxilio funerario',
    precio_desde: '96000',
    disponible: false,
    coberturas: [],
  },
];

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('ProductsScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    useQuoteStore.getState().clear();
    global.fetch = jest.fn(async () => jsonResponse(PRODUCTS)) as typeof fetch;
  });

  it('loads the mobile catalog and shows prices and descriptions from the response', async () => {
    const { getByText, getByTestId } = await render(<ProductsScreen />);

    expect(getByText('Comprar seguro')).toBeTruthy();
    expect(getByText('Cotiza y activa tu cobertura')).toBeTruthy();

    await waitFor(() => {
      expect(getByText('Viaje Internacional')).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/movil\/productos$/), expect.objectContaining({
      method: 'GET',
    }));
    expect(getByText('Protección Celular')).toBeTruthy();
    expect(getByText('Vida Esencial')).toBeTruthy();
    expect(getByText('Gastos médicos, equipaje y asistencia en viaje')).toBeTruthy();
    expect(getByText('Daño accidental, robo y líquidos')).toBeTruthy();
    expect(getByText('Fallecimiento y auxilio funerario')).toBeTruthy();
    expect(getByText('Desde $120.000')).toBeTruthy();
    expect(getByText('Desde $250.000')).toBeTruthy();
    expect(getByText('Desde $96.000')).toBeTruthy();
    expect(getByTestId('product-viaje-internacional').props.accessibilityState?.disabled).not.toBe(true);
    expect(getByTestId('product-proteccion-celular').props.accessibilityState).toEqual({ disabled: true });
    expect(getByTestId('product-vida-esencial').props.accessibilityState).toEqual({ disabled: true });
  });

  it('shows Próximamente on both unavailable products', async () => {
    const { findAllByText } = await render(<ProductsScreen />);

    expect(await findAllByText('Próximamente')).toHaveLength(2);
  });

  it('opens the viaje form and ignores taps on unavailable products', async () => {
    const { findByText, getByText } = await render(<ProductsScreen />);

    await findByText('Viaje Internacional');
    await fireEvent.press(getByText('Protección Celular'));
    await fireEvent.press(getByText('Vida Esencial'));

    expect(useNavigation().navigate).not.toHaveBeenCalled();
    expect(useQuoteStore.getState().product).toBeNull();

    await fireEvent.press(getByText('Viaje Internacional'));

    expect(useQuoteStore.getState().product?.id).toBe('viaje-internacional');
    expect(useNavigation().navigate).toHaveBeenCalledWith('Quote');
    expect(useNavigation().navigate).toHaveBeenCalledTimes(1);
  });

  it('shows a banner when the catalog cannot be loaded', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ detail: 'Catálogo no disponible.' }, 503)) as typeof fetch;
    const { findByText, queryByText } = await render(<ProductsScreen />);

    expect(await findByText('Catálogo no disponible.')).toBeTruthy();
    expect(queryByText('Viaje Internacional')).toBeNull();
  });

  it('falls back to the catalog error copy when the API has no detail', async () => {
    global.fetch = jest.fn(async () => jsonResponse({}, 500)) as typeof fetch;
    const { findByText } = await render(<ProductsScreen />);

    expect(await findByText('No se pudieron cargar los productos.')).toBeTruthy();
  });
});
