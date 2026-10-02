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
  it('shows the counter and opens the component list', async () => {
    const { getByText, queryByText } = await render(<HomeScreen />);

    expect(getByText('Contador - 0')).toBeTruthy();
    expect(queryByText('Ver campos')).toBeNull();
    expect(queryByText('En línea')).toBeNull();

    await fireEvent.press(getByText('Aumentar'));

    expect(getByText('Contador - 1')).toBeTruthy();

    await fireEvent.press(getByText('Componentes'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('Components');
  });
});
