import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import HomeScreen from './index';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  return {
    useNavigation: () => ({ navigate }),
  };
});

describe('HomeScreen', () => {
  beforeEach(() => {
    global.__DEV__ = true;
    useNavigation().navigate.mockClear();
  });

  it('shows the counter', async () => {
    const { getByText, queryByText } = await render(<HomeScreen />);

    expect(getByText('Contador - 0')).toBeTruthy();
    expect(getByText('Hola, María')).toBeTruthy();
    expect(getByText('Tu cobertura')).toBeTruthy();
    expect(queryByText('En línea')).toBeNull();
    expect(queryByText('Componentes')).toBeNull();

    await fireEvent.press(getByText('Aumentar'));

    expect(getByText('Contador - 1')).toBeTruthy();
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
