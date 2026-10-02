import { fireEvent, render } from '@testing-library/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../theme';
import { DateField } from '.';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

describe('DateField', () => {
  it('shows the placeholder when no date is set', async () => {
    const { getByText } = await render(<DateField label="Fecha de salida" />);

    expect(getByText('dd/mm/aaaa')).toBeTruthy();
  });

  it('shows a day-first date as given', async () => {
    const { getByText } = await render(<DateField label="Fecha de salida" value="10/10/2026" />);

    expect(getByText('10/10/2026')).toBeTruthy();
  });

  it('shows an iso date as day-first and keeps the time', async () => {
    const { getByText } = await render(
      <DateField label="Fecha y hora de ocurrencia" value="2026-09-12 10:30" />,
    );

    expect(getByText('12/09/2026 10:30')).toBeTruthy();
  });

  it('shows the required message when the field has an error', async () => {
    const { getByText } = await render(<DateField label="Fecha de salida" error />);

    expect(getByText('Obligatorio')).toBeTruthy();
  });

  it('chooses a day and closes the calendar', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText, queryByText } = await render(
      <DateField label="Fecha de salida" value="10/10/2026" onChange={onChange} />,
    );

    await fireEvent.press(getByText('10/10/2026'));

    expect(getByText('Octubre 2026')).toBeTruthy();

    await fireEvent.press(getByLabelText('Mes siguiente'));
    expect(getByText('Noviembre 2026')).toBeTruthy();

    await fireEvent.press(getByLabelText('Mes anterior'));
    await fireEvent.press(getByLabelText('15 de octubre de 2026'));

    expect(onChange).toHaveBeenCalledWith('15/10/2026');
    expect(queryByText('Octubre 2026')).toBeNull();
  });

  it('keeps the time when a new day is chosen', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText } = await render(
      <DateField label="Fecha y hora de ocurrencia" value="2026-09-12 10:30" onChange={onChange} />,
    );

    await fireEvent.press(getByText('12/09/2026 10:30'));
    await fireEvent.press(getByLabelText('15 de septiembre de 2026'));

    expect(onChange).toHaveBeenCalledWith('15/09/2026 10:30');
  });

  it('keeps the calendar above the bottom inset', async () => {
    const { getByTestId, getByText } = await render(
      <DateField label="Fecha de salida" value="10/10/2026" />,
    );

    await fireEvent.press(getByText('10/10/2026'));

    expect(getByTestId('date-sheet')).toHaveStyle({
      paddingBottom: useSafeAreaInsets().bottom + theme.space.lg,
    });
  });
});
