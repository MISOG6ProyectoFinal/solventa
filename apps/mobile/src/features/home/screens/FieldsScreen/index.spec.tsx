import { fireEvent, render } from '@testing-library/react-native';

import { theme } from '../../../../shared/theme';
import FieldsScreen from './index';

describe('FieldsScreen', () => {
  it('shows an empty required field, then Obligatorio after submit', async () => {
    const { getByTestId, getByText, queryByText } = await render(<FieldsScreen />);

    expect(getByText(/Nombre completo/)).toHaveStyle({
      fontFamily: 'Outfit-Medium',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontSize: theme.type.label.fontSize,
      color: theme.type.label.color,
    });
    expect(getByTestId('fields-name')).toHaveStyle({
      borderColor: theme.colors.border,
    });
    expect(queryByText('Obligatorio')).toBeNull();

    expect(getByText('▼')).toBeTruthy();
    expect(getByTestId('fields-select')).toHaveStyle({
      borderColor: theme.colors.border,
    });

    expect(getByTestId('fields-date-icon', { includeHiddenElements: true }).props).toMatchObject({
      stroke: theme.colors.textMuted,
      strokeWidth: 1.5,
      width: 16,
    });
    expect(getByTestId('fields-date')).toHaveStyle({
      borderColor: theme.colors.border,
    });

    expect(getByText(/Simular pago rechazado/)).toHaveStyle({
      textTransform: 'uppercase',
    });
    expect(getByTestId('fields-checkbox')).toHaveStyle({
      borderColor: theme.colors.border,
    });

    await fireEvent.press(getByTestId('fields-submit'));

    expect(getByText('Obligatorio')).toHaveStyle({ color: theme.colors.danger });
    expect(getByTestId('fields-name')).toHaveStyle({
      borderColor: theme.colors.danger,
    });
  });
});
