import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import HomeScreen from './index';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      canGoBack: () => false,
      goBack: jest.fn(),
    }),
  };
});

describe('HomeScreen', () => {
  beforeEach(() => {
    global.__DEV__ = true;
    useNavigation().navigate.mockClear();
  });

  it('shows the coverage summary without the offline state', async () => {
    const { getByText, queryByText } = await render(<HomeScreen />);

    expect(getByText('Hola, María')).toBeTruthy();
    expect(getByText('Tu cobertura')).toBeTruthy();
    expect(getByText('Cobertura activa')).toBeTruthy();
    expect(getByText('3 pólizas')).toBeTruthy();
    expect(getByText('Ver pólizas')).toBeTruthy();
    expect(getByText('Comprar')).toBeTruthy();
    expect(getByText('Siniestros')).toBeTruthy();
    expect(getByText('Consulta y reporta')).toBeTruthy();
    expect(getByText('Comprar seguro')).toBeTruthy();
    expect(getByText('Cotiza y paga en minutos')).toBeTruthy();
    expect(getByText('Próxima a renovar')).toBeTruthy();
    expect(getByText('Protección Celular')).toBeTruthy();
    expect(getByText('SLV-2025-01820 · Vence 2026-10-05')).toBeTruthy();
    expect(getByText('Ver oferta de renovación')).toBeTruthy();
    expect(queryByText('Sin conexión')).toBeNull();
    expect(queryByText('Componentes')).toBeNull();
    expect(queryByText(/Contador/)).toBeNull();
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

  it('opens the component list from a long press on the menu in dev', async () => {
    global.__DEV__ = true;
    const { getByLabelText } = await render(<HomeScreen />);

    await fireEvent(getByLabelText('Menú'), 'longPress');

    expect(useNavigation().navigate).toHaveBeenCalledWith('Components');
  });

  it('ignores a long press on the menu outside dev', async () => {
    global.__DEV__ = false;
    const { getByLabelText } = await render(<HomeScreen />);

    await fireEvent(getByLabelText('Menú'), 'longPress');

    expect(useNavigation().navigate).not.toHaveBeenCalled();
  });
});
