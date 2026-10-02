import { render } from '@testing-library/react-native';

import { theme } from '../../../../shared/theme';
import HomeScreen from './index';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

describe('HomeScreen', () => {
  it('shows the shared screen, card, banner, chip, and buttons', async () => {
    const { getByText, getByTestId } = await render(<HomeScreen />);

    expect(getByTestId('home-screen')).toHaveStyle({
      backgroundColor: theme.colors.background,
    });
    expect(getByTestId('home-surface')).toHaveStyle({
      backgroundColor: theme.colors.surface,
    });
    expect(getByText('Contador - 0')).toHaveStyle({
      fontFamily: 'Outfit-Regular',
      fontSize: theme.type.body.fontSize,
      color: theme.type.body.color,
    });

    expect(getByText('Aumentar')).toHaveStyle({ color: theme.colors.onNavy });
    expect(getByTestId('home-primary')).toHaveStyle({
      backgroundColor: theme.colors.navy,
    });

    expect(getByText('Ver detalle')).toHaveStyle({ color: theme.colors.onNavy });
    expect(getByTestId('home-confirm')).toHaveStyle({
      backgroundColor: theme.colors.teal,
    });

    expect(
      getByText('Tu póliza fue emitida y tu seguro ya está activo'),
    ).toHaveStyle({ color: theme.colors.success.text });
    expect(getByTestId('home-banner')).toHaveStyle({
      backgroundColor: theme.colors.success.background,
    });

    expect(getByText('En línea')).toHaveStyle({ color: theme.colors.navy });
    expect(getByTestId('home-chip')).toHaveStyle({
      backgroundColor: theme.colors.surface,
    });
  });
});
