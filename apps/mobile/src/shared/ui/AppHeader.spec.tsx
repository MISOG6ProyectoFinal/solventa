import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { theme } from '../theme';
import { AppHeader } from './AppHeader';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

const navigation = {
  goBack: jest.fn(),
  canGoBack: jest.fn(),
};

describe('AppHeader', () => {
  beforeEach(() => {
    navigation.goBack.mockClear();
    navigation.canGoBack.mockReset();
    jest.mocked(useNavigation).mockReturnValue(navigation as never);
  });

  it('shows the title, subtitle, and leading icon', async () => {
    navigation.canGoBack.mockReturnValue(false);

    const { getByLabelText, getByTestId, getByText, queryByLabelText, queryByText } = await render(
      <AppHeader
        title="Hola, María"
        subtitle="Tu cobertura"
        leadingIcon={{ icon: 'menu', label: 'Menú' }}
      />,
    );

    expect(getByText('Hola, María')).toHaveStyle({
      fontFamily: 'Fraunces-SemiBold',
      fontSize: 18,
      lineHeight: 22.5,
      color: theme.colors.onNavy,
    });
    expect(getByText('Tu cobertura')).toHaveStyle({
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.onNavyMuted,
    });
    expect(queryByText('En línea')).toBeNull();
    expect(getByLabelText('Menú')).toBeTruthy();
    expect(queryByLabelText('Volver')).toBeNull();
    expect(getByTestId('app-header')).toHaveStyle({ backgroundColor: theme.colors.navy });
  });

  it('keeps a title-only bar as tall as the icon button', async () => {
    navigation.canGoBack.mockReturnValue(false);

    const { getByTestId, getByText, queryByLabelText, queryByText } = await render(
      <AppHeader title="Siniestros" />,
    );

    expect(getByText('Siniestros')).toBeTruthy();
    expect(queryByText('Conectado')).toBeNull();
    expect(queryByLabelText('Volver')).toBeNull();
    expect(getByTestId('app-header-row')).toHaveStyle({ minHeight: 44 });
  });

  it('shows the back button when navigation can go back', async () => {
    navigation.canGoBack.mockReturnValue(true);

    const { getByLabelText, queryByLabelText } = await render(
      <AppHeader title="Componentes" leadingIcon={{ icon: 'menu', label: 'Menú' }} />,
    );

    expect(queryByLabelText('Menú')).toBeNull();

    await fireEvent.press(getByLabelText('Volver'));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
