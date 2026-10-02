import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import ComponentsScreen from './index';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      canGoBack: () => true,
      goBack: jest.fn(),
    }),
  };
});

describe('ComponentsScreen', () => {
  it('lists the components and opens the selected one', async () => {
    const { getByText } = await render(<ComponentsScreen />);

    expect(getByText('Texto')).toBeTruthy();
    expect(getByText('Botón')).toBeTruthy();
    expect(getByText('Campo de texto')).toBeTruthy();
    expect(getByText('Ícono')).toBeTruthy();

    await fireEvent.press(getByText('Botón'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('Component', { id: 'button' });
  });
});
