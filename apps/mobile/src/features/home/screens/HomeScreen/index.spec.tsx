import { render } from '@testing-library/react-native';

import { theme } from '../../../../shared/theme';
import HomeScreen from './index';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

describe('HomeScreen', () => {
  it('renders the counter on the theme background and a surface block', async () => {
    const { getByText, getByTestId } = await render(<HomeScreen />);

    expect(getByTestId('home-screen')).toHaveStyle({
      backgroundColor: theme.colors.background,
    });
    expect(getByText('Counter - 0')).toHaveStyle({
      fontSize: theme.type.body.fontSize,
      color: theme.type.body.color,
    });
    expect(getByTestId('home-surface')).toHaveStyle({
      backgroundColor: theme.colors.surface,
    });
  });
});
