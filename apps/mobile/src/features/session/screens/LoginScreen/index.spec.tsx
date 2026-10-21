import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import LoginScreen from './index';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  return {
    useNavigation: () => ({ navigate, canGoBack: () => false, goBack: jest.fn() }),
  };
});

describe('LoginScreen dev tools', () => {
  beforeEach(() => {
    jest.mocked(useNavigation().navigate).mockClear();
  });

  it('opens the dev tools from the top right button in dev', async () => {
    global.__DEV__ = true;
    const { getByLabelText } = await render(<LoginScreen />);

    await fireEvent.press(getByLabelText('Herramientas de desarrollo'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('DevTools');
  });

  it('hides the dev tools button outside dev', async () => {
    global.__DEV__ = false;
    const { queryByLabelText } = await render(<LoginScreen />);

    expect(queryByLabelText('Herramientas de desarrollo')).toBeNull();
  });
});
