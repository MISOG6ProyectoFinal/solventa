import { fireEvent, render } from '@testing-library/react-native';

import { useQuoteStore } from '../../../quote/store/useQuoteStore';
import { es as texts } from '../../texts/es';
import PoliciesScreen from './index';

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: () => false,
    }),
    useFocusEffect: (effect: () => undefined | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

const PRODUCTO = {
  id: 'viaje-internacional',
  nombre: 'Viaje Internacional',
  descripcion: 'Gastos médicos, equipaje y asistencia en viaje',
  precio_desde: '120000',
  disponible: true,
  coberturas: [],
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

function mockBackend(policies: unknown[]) {
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/productos')) {
      return jsonResponse([PRODUCTO]);
    }
    return jsonResponse(policies);
  }) as typeof fetch;
}

describe('PoliciesScreen', () => {
  beforeEach(() => {
    useQuoteStore.getState().clear();
    mockBackend([]);
  });

  it('shows an empty state when the backend has no active policies', async () => {
    const { findByText, queryByText } = await render(<PoliciesScreen />);

    expect(await findByText(texts.policies.emptyMessage)).toBeTruthy();
    expect(queryByText('ACTIVA')).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/movil\/polizas$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads the policy from the backend and ignores the quote store', async () => {
    useQuoteStore.getState().selectProduct({
      id: 'store-product',
      nombre: 'Producto del store',
      descripcion: 'No debe verse',
      precio_desde: '1',
      disponible: true,
      coberturas: [],
    });
    useQuoteStore.getState().setOferta({
      id: 'oferta-store',
      producto_id: 'store-product',
      prima: '1.00',
      coberturas: [{ id: 'store', nombre: 'Cobertura del store' }],
      vigencia_propuesta: { desde: '2020-01-01', hasta: '2020-01-02' },
      vigente_hasta: '2020-01-01T23:59:59-05:00',
      version_reglas: '2026.10.0',
    });
    mockBackend([POLIZA]);
    const { findByText, getByText, queryByText } = await render(<PoliciesScreen />);

    expect(await findByText('Viaje Internacional')).toBeTruthy();
    expect(getByText('POL-75885ABCDE')).toBeTruthy();
    expect(getByText('ACTIVA')).toBeTruthy();
    expect(getByText('Inicio 2026-10-10')).toBeTruthy();
    expect(getByText('Fin 2026-10-24')).toBeTruthy();
    expect(getByText('Prima $149.940')).toBeTruthy();
    expect(getByText('Gastos médicos en el exterior')).toBeTruthy();
    expect(getByText('Cancelación de viaje')).toBeTruthy();
    expect(getByText('Pérdida de equipaje')).toBeTruthy();
    expect(getByText('Asistencia en viaje')).toBeTruthy();
    expect(queryByText('Producto del store')).toBeNull();
    expect(queryByText('Cobertura del store')).toBeNull();
    expect(queryByText('Inicio 2020-01-01')).toBeNull();

    useQuoteStore.getState().clear();
    expect(useQuoteStore.getState().oferta).toBeNull();
    expect(getByText('Viaje Internacional')).toBeTruthy();
    expect(getByText('POL-75885ABCDE')).toBeTruthy();
  });

  it('does not show a failed emission as active', async () => {
    mockBackend([{ ...POLIZA, id: 'poliza-fallida', numero: 'POL-00001AAAAA', estado: 'fallida' }]);
    const { findByText, queryByText } = await render(<PoliciesScreen />);

    expect(await findByText(texts.policies.emptyMessage)).toBeTruthy();
    expect(queryByText('ACTIVA')).toBeNull();
    expect(queryByText('POL-00001AAAAA')).toBeNull();
  });

  it('reloads from the backend when the list is refreshed', async () => {
    let policyLoads = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/productos')) {
        return jsonResponse([PRODUCTO]);
      }
      policyLoads += 1;
      return jsonResponse(policyLoads === 1 ? [] : [POLIZA]);
    }) as typeof fetch;
    const { findByText, getByTestId } = await render(<PoliciesScreen />);

    expect(await findByText(texts.policies.emptyMessage)).toBeTruthy();
    fireEvent(getByTestId('policies-refresh'), 'refresh');

    expect(await findByText('POL-75885ABCDE')).toBeTruthy();
    const policyCalls = jest.mocked(fetch).mock.calls.filter((call) => String(call[0]).includes('/polizas'));
    expect(policyCalls).toHaveLength(2);
  });
});
