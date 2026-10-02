import { render } from '@testing-library/react-native';

import { theme } from '../theme';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('shows the home bar', async () => {
    const { getByLabelText, getByTestId, getByText, queryByText } = await render(
      <AppHeader variant="home" greeting="Hola, María" />,
    );

    expect(getByText('Hola, María')).toHaveStyle({
      fontFamily: 'Fraunces-SemiBold',
      fontSize: 18,
      lineHeight: 22.5,
      color: theme.colors.onNavy,
    });
    expect(getByText('Tu cobertura')).toBeTruthy();
    expect(queryByText('En línea')).toBeNull();
    expect(getByLabelText('Menú')).toBeTruthy();
    expect(getByTestId('app-header')).toHaveStyle({ backgroundColor: theme.colors.navy });
  });

  it('shows a back title', async () => {
    const hidden = await render(<AppHeader variant="flow" title="Componentes" />);

    expect(hidden.getByText('Componentes')).toBeTruthy();
    expect(hidden.getByLabelText('Volver')).toBeTruthy();
  });
});
