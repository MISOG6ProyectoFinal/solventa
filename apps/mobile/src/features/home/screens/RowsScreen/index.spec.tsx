import { fireEvent, render } from '@testing-library/react-native';

import { theme } from '../../../../shared/theme';
import RowsScreen from './index';

describe('RowsScreen', () => {
  it('shows a price, a premium comparison, coverages, options, and a thumbnail', async () => {
    const { getByTestId, getByText } = await render(<RowsScreen />);

    expect(getByText('$ 149.940')).toHaveStyle({
      fontFamily: 'Fraunces-SemiBold',
      fontSize: theme.type.amount.fontSize,
      fontWeight: theme.type.amount.fontWeight,
      color: theme.type.amount.color,
    });

    expect(getByText('Prima actual')).toBeTruthy();
    expect(getByText('$ 420.000')).toBeTruthy();
    expect(getByText('Nueva prima')).toBeTruthy();
    expect(getByText('$ 453.600')).toBeTruthy();

    expect(getByText('Gastos médicos')).toHaveStyle({
      fontFamily: 'Outfit-Regular',
      fontSize: theme.type.body.fontSize,
      color: theme.type.body.color,
    });
    expect(getByText('Cancelación de viaje')).toBeTruthy();
    expect(getByText('Pérdida de equipaje')).toBeTruthy();
    expect(getByText('Asistencia en viaje')).toBeTruthy();

    expect(getByText('Perito')).toHaveStyle({
      fontFamily: 'Outfit-Regular',
      fontSize: theme.type.body.fontSize,
      color: theme.type.body.color,
    });
    expect(getByTestId('option-perito')).toHaveStyle({
      borderColor: theme.colors.borderSelected,
    });
    expect(getByTestId('option-grua')).toHaveStyle({
      borderColor: theme.colors.border,
    });

    await fireEvent.press(getByText('Grúa'));

    expect(getByTestId('option-grua')).toHaveStyle({
      borderColor: theme.colors.borderSelected,
    });
    expect(getByTestId('option-perito')).toHaveStyle({
      borderColor: theme.colors.border,
    });

    expect(getByText('Foto 1')).toBeTruthy();
    expect(getByText('1,6 MB')).toHaveStyle({
      fontFamily: 'Outfit-Medium',
      fontSize: theme.type.caption.fontSize,
      color: theme.type.caption.color,
    });
    expect(getByTestId('rows-thumbnail')).toHaveStyle({
      width: 72,
      height: 72,
    });
  });
});
