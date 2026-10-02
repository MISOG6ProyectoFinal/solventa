import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { theme } from '../../../../shared/theme';
import ClaimsScreen from './index';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  const goBack = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      goBack,
      canGoBack: () => true,
    }),
  };
});

describe('ClaimsScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    useNavigation().goBack.mockClear();
  });

  it('shows the empty claims list while online', async () => {
    const { getByText, queryByText } = await render(<ClaimsScreen />);

    expect(getByText('Siniestros')).toHaveStyle({
      fontFamily: 'Fraunces-SemiBold',
      fontSize: 18,
      lineHeight: 22.5,
      color: theme.colors.onNavy,
    });
    expect(queryByText('Conectado')).toBeNull();
    expect(getByText('Aún no tienes reportes.')).toHaveStyle({ textAlign: 'center' });
    expect(getByText('Reportar siniestro')).toBeTruthy();
    expect(queryByText('Sin conexión')).toBeNull();
  });

  it('opens the report flow', async () => {
    const { getByText } = await render(<ClaimsScreen />);

    await fireEvent.press(getByText('Reportar siniestro'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('ClaimReport');
  });

  it('goes back from the header', async () => {
    const { getByLabelText } = await render(<ClaimsScreen />);

    await fireEvent.press(getByLabelText('Volver'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);
  });
});
