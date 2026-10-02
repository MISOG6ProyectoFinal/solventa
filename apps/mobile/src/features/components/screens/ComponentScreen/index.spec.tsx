import { fireEvent, render } from '@testing-library/react-native';

import { theme } from '../../../../shared/theme';
import ComponentScreen from './index';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    canGoBack: () => true,
    goBack: jest.fn(),
  }),
}));

describe('ComponentScreen', () => {
  it('shows the component and updates it when a prop changes', async () => {
    const { getByDisplayValue, getByTestId, getByText } = await render(
      <ComponentScreen route={{ key: 'Component', name: 'Component', params: { id: 'button' } }} />,
    );

    expect(getByText('Continuar')).toBeTruthy();
    expect(getByTestId('component-preview')).toHaveStyle({
      backgroundColor: theme.colors.navy,
    });

    await fireEvent.changeText(getByDisplayValue('Continuar'), 'Pagar');
    await fireEvent.press(getByText('Secundario'));

    expect(getByText('Pagar')).toBeTruthy();
    expect(getByTestId('component-preview')).toHaveStyle({
      backgroundColor: theme.colors.blue,
    });
  });
});
