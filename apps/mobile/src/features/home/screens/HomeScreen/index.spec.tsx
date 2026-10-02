import { fireEvent, render } from '@testing-library/react-native';

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

    expect(getByText('Continuar')).toHaveStyle({ color: theme.colors.onNavy });
    expect(getByTestId('home-secondary')).toHaveStyle({
      backgroundColor: theme.colors.blue,
    });

    expect(getByText('Ver detalle')).toHaveStyle({ color: theme.colors.onNavy });
    expect(getByTestId('home-accent')).toHaveStyle({
      backgroundColor: theme.colors.teal,
    });

    expect(getByText('Ver campos')).toHaveStyle({ color: theme.colors.text });
    expect(getByTestId('home-outlined')).toHaveStyle({
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    });

    expect(getByText('No disponible')).toHaveStyle({ color: theme.colors.textMuted });
    expect(getByTestId('home-disabled')).toHaveStyle({
      backgroundColor: theme.colors.border,
    });

    expect(
      getByText('Tu póliza fue emitida y tu seguro ya está activo'),
    ).toHaveStyle({
      color: theme.colors.success.text,
      fontSize: theme.type.bodySmall.fontSize,
    });
    expect(getByTestId('home-banner')).toHaveStyle({
      backgroundColor: theme.colors.success.background,
      borderColor: theme.colors.success.border,
    });
    expect(getByTestId('home-banner-icon', { includeHiddenElements: true }).props).toMatchObject({
      stroke: theme.colors.teal,
      strokeWidth: 1.5,
      width: 20,
    });

    expect(getByText('En línea')).toHaveStyle({ color: theme.colors.text });
    expect(getByTestId('home-chip')).toHaveStyle({
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    });
    expect(getByTestId('home-chip-active')).toHaveStyle({
      backgroundColor: theme.colors.navy,
    });
    expect(getByTestId('home-chip-paid')).toHaveStyle({
      backgroundColor: theme.colors.teal,
    });
    expect(getByTestId('home-chip-pending')).toHaveStyle({
      backgroundColor: theme.colors.warning.background,
      borderColor: theme.colors.warning.border,
    });

    expect(getByText('3')).toHaveStyle({
      fontFamily: theme.type.sectionTitle.fontFamily,
      fontSize: theme.type.sectionTitle.fontSize,
      color: theme.colors.onNavy,
    });

    expect(getByTestId('home-switch')).toHaveStyle({
      backgroundColor: theme.colors.border,
    });
    await fireEvent.press(getByTestId('home-switch'));
    expect(getByTestId('home-switch')).toHaveStyle({
      backgroundColor: theme.colors.teal,
    });

    expect(getByText('Principal')).toHaveStyle({ color: theme.colors.navy });
    expect(getByText('Secundaria')).toHaveStyle({ color: theme.colors.blue });
    expect(getByText('Acento')).toHaveStyle({ color: theme.colors.teal });
  });
});
