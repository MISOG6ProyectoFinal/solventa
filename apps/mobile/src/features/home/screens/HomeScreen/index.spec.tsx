import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { useLanguageStore } from '../../../../shared/i18n/useLanguageStore';
import { listPolicies } from '../../../policies/api/listPolicies';
import { Policy } from '../../../policies/types';
import { getProducts } from '../../../quote/api/getProducts';
import { useSessionStore } from '../../../session/store/useSessionStore';
import HomeScreen from './index';

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const navigate = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      dispatch: jest.fn(),
      canGoBack: () => false,
      goBack: jest.fn(),
    }),
    DrawerActions: { openDrawer: () => ({ type: 'OPEN_DRAWER' }) },
    useFocusEffect: (effect: () => undefined | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

jest.mock('../../../policies/api/listPolicies', () => ({
  listPolicies: jest.fn(),
}));

jest.mock('../../../quote/api/getProducts', () => ({
  getProducts: jest.fn(),
}));

const PRODUCTO = {
  id: 'viaje-internacional',
  nombre: 'Viaje Internacional',
  descripcion: 'Gastos médicos, equipaje y asistencia en viaje',
  precio_desde: '120000',
  disponible: true,
  coberturas: [],
};

const RENOVABLE: Policy = {
  id: 'poliza-1',
  numero: 'POL-75885ABCDE',
  cotizacion_id: 'oferta-1',
  cobro_id: 'cobro-1',
  producto_id: 'viaje-internacional',
  prima: '149940.00',
  estado: 'activa',
  vigencia: { desde: '2026-10-10', hasta: '2026-12-20' },
  coberturas: [{ id: 'medicos', nombre: 'Gastos médicos en el exterior' }],
  renovable: true,
};

const NO_RENOVABLE: Policy = {
  ...RENOVABLE,
  id: 'poliza-2',
  numero: 'POL-00000BBBBB',
  renovable: false,
};

async function settlePolicies() {
  await waitFor(() => expect(jest.mocked(listPolicies).mock.results.length).toBeGreaterThan(0));
  const pending = jest.mocked(listPolicies).mock.results.at(-1)?.value;
  await act(async () => {
    await pending?.catch(() => undefined);
  });
}

describe('HomeScreen', () => {
  beforeEach(() => {
    global.__DEV__ = true;
    useNavigation().navigate.mockClear();
    useSessionStore.setState({ firstName: 'Ana' });
    jest.mocked(listPolicies).mockReset();
    jest.mocked(getProducts).mockReset();
    jest.mocked(listPolicies).mockResolvedValue([]);
    jest.mocked(getProducts).mockResolvedValue([]);
  });

  it('shows the coverage summary without the offline state', async () => {
    jest
      .mocked(listPolicies)
      .mockResolvedValue([
        NO_RENOVABLE,
        { ...NO_RENOVABLE, id: 'poliza-3' },
        { ...NO_RENOVABLE, id: 'poliza-4', estado: 'vencida' },
      ]);
    const { findByText, getByText, queryByText } = await render(<HomeScreen />);

    expect(getByText('Hola, Ana')).toBeTruthy();
    expect(getByText('Tu cobertura')).toBeTruthy();
    expect(getByText('Cobertura activa')).toBeTruthy();
    expect(await findByText('2 pólizas')).toBeTruthy();
    expect(getByText('Ver pólizas')).toBeTruthy();
    expect(getByText('Comprar')).toBeTruthy();
    expect(getByText('Siniestros')).toBeTruthy();
    expect(getByText('Consulta y reporta')).toBeTruthy();
    expect(getByText('Comprar seguro')).toBeTruthy();
    expect(getByText('Cotiza y paga en minutos')).toBeTruthy();
    expect(getByText('Asistencia cercana')).toBeTruthy();
    expect(getByText('Prestadores aliados cerca de ti')).toBeTruthy();
    await settlePolicies();
    expect(queryByText('Próxima a renovar')).toBeNull();
    expect(queryByText('Ver oferta de renovación')).toBeNull();
    expect(queryByText('Protección Celular')).toBeNull();
    expect(queryByText('SLV-2025-01820')).toBeNull();
    expect(queryByText('Cerrar sesión')).toBeNull();
    expect(queryByText('Sin conexión')).toBeNull();
    expect(queryByText('Componentes')).toBeNull();
    expect(queryByText(/Contador/)).toBeNull();
  });

  it('shows the greeting and shortcuts in English', async () => {
    const { getByText, queryByText } = await render(<HomeScreen />);

    await act(async () => {
      useLanguageStore.setState({ language: 'en' });
    });

    expect(getByText('Hello, Ana')).toBeTruthy();
    expect(getByText('Nearby assistance')).toBeTruthy();
    expect(queryByText('Hola, Ana')).toBeNull();
  });

  it('opens the matching tab from the coverage actions and the shortcuts', async () => {
    const { getByText } = await render(<HomeScreen />);

    await fireEvent.press(getByText('Ver pólizas'));
    expect(useNavigation().navigate).toHaveBeenCalledWith('Main', { screen: 'Policies' });

    await fireEvent.press(getByText('Comprar'));
    expect(useNavigation().navigate).toHaveBeenCalledWith('Main', { screen: 'Buy' });

    await fireEvent.press(getByText('Siniestros'));
    expect(useNavigation().navigate).toHaveBeenCalledWith('Main', { screen: 'Claims' });

    await fireEvent.press(getByText('Comprar seguro'));
    expect(useNavigation().navigate).toHaveBeenCalledWith('Main', { screen: 'Buy' });
  });

  it('opens the nearby providers map from its shortcut', async () => {
    const { getByText } = await render(<HomeScreen />);

    await fireEvent.press(getByText('Asistencia cercana'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('NearbyProviders');
  });

  it('opens the policy detail from the real renewal offer', async () => {
    jest.mocked(listPolicies).mockResolvedValue([NO_RENOVABLE, RENOVABLE]);
    jest.mocked(getProducts).mockResolvedValue([PRODUCTO]);
    const { findByText, getByText, queryByText } = await render(<HomeScreen />);

    expect(await findByText('Viaje Internacional')).toBeTruthy();
    expect(getByText('Próxima a renovar')).toBeTruthy();
    expect(getByText('POL-75885ABCDE · Vence 2026-12-20')).toBeTruthy();
    expect(queryByText('Protección Celular')).toBeNull();
    expect(queryByText('SLV-2025-01820')).toBeNull();
    expect(queryByText('2026-10-05')).toBeNull();

    fireEvent.press(getByText('Ver oferta de renovación'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('PolicyDetail', {
      policy: RENOVABLE,
      productName: 'Viaje Internacional',
    });
  });

  it('hides the renewal card when no active policy is renewable', async () => {
    jest.mocked(listPolicies).mockResolvedValue([NO_RENOVABLE]);
    jest.mocked(getProducts).mockResolvedValue([PRODUCTO]);
    const { getByText, queryByText } = await render(<HomeScreen />);

    expect(getByText('Hola, Ana')).toBeTruthy();
    await settlePolicies();
    expect(queryByText('Ver oferta de renovación')).toBeNull();
    expect(queryByText('Próxima a renovar')).toBeNull();
    expect(queryByText('Viaje Internacional')).toBeNull();
    expect(queryByText('POL-00000BBBBB')).toBeNull();
    expect(queryByText('Protección Celular')).toBeNull();
    expect(queryByText('SLV-2025-01820')).toBeNull();
    expect(queryByText('2026-10-05')).toBeNull();
  });

  it('keeps home usable when the policies request fails', async () => {
    jest.mocked(listPolicies).mockRejectedValue(new Error('down'));
    const { getByText, queryByText } = await render(<HomeScreen />);

    expect(getByText('Hola, Ana')).toBeTruthy();
    expect(getByText('Ver pólizas')).toBeTruthy();
    expect(getByText('Comprar')).toBeTruthy();
    await settlePolicies();
    expect(queryByText('Ver oferta de renovación')).toBeNull();
    expect(queryByText('Próxima a renovar')).toBeNull();
    expect(queryByText('Protección Celular')).toBeNull();
  });

  it('opens the dev tools from a long press on the menu in dev', async () => {
    global.__DEV__ = true;
    const { getByLabelText } = await render(<HomeScreen />);

    await fireEvent(getByLabelText('Menú'), 'longPress');

    expect(useNavigation().navigate).toHaveBeenCalledWith('DevTools');
  });

  it('ignores a long press on the menu outside dev', async () => {
    global.__DEV__ = false;
    const { getByLabelText } = await render(<HomeScreen />);

    await fireEvent(getByLabelText('Menú'), 'longPress');

    expect(useNavigation().navigate).not.toHaveBeenCalled();
  });
});
