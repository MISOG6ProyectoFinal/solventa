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

  it('does not offer a time change unless time selection is enabled', async () => {
    const { getByText, queryByLabelText } = await render(
      <DateField label="Fecha y hora de ocurrencia" value="2026-09-12 10:30" />,
    );

    await fireEvent.press(getByText('12/09/2026 10:30'));

    expect(queryByLabelText('Hora')).toBeNull();
    expect(queryByLabelText('Minuto')).toBeNull();
  });

  it('shows a time placeholder when time selection is enabled and no date is set', async () => {
    const { getByText } = await render(<DateField label="Fecha y hora de ocurrencia" timeSelection />);

    expect(getByText('dd/mm/aaaa hh:mm')).toBeTruthy();
  });

  it('changes the hour and minute when time selection is enabled', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText, queryByLabelText, queryByText } = await render(
      <DateField label="Fecha y hora de ocurrencia" value="2026-09-12 10:30" onChange={onChange} timeSelection />,
    );

    await fireEvent.press(getByText('12/09/2026 10:30'));

    expect(queryByLabelText('Hora')).toBeNull();

    await fireEvent.press(getByLabelText('15 de septiembre de 2026'));

    expect(getByLabelText('Hora')).toHaveProp('value', '10');
    expect(getByLabelText('Minuto')).toHaveProp('value', '30');
    expect(queryByText('Septiembre 2026')).toBeNull();

    await fireEvent.changeText(getByLabelText('Hora'), '11');
    await fireEvent.changeText(getByLabelText('Minuto'), '29');
    await fireEvent.press(getByText('Listo'));

    expect(onChange).toHaveBeenCalledWith('15/09/2026 11:29');
    expect(queryByLabelText('Hora')).toBeNull();
  });

  it('ignores an hour or minute outside the clock', async () => {
    const { getByLabelText, getByText } = await render(
      <DateField label="Fecha y hora de ocurrencia" value="2026-09-12 10:30" timeSelection />,
    );

    await fireEvent.press(getByText('12/09/2026 10:30'));
    await fireEvent.press(getByLabelText('12 de septiembre de 2026'));
    await fireEvent.changeText(getByLabelText('Hora'), '25');
    await fireEvent.changeText(getByLabelText('Minuto'), '60');

    expect(getByLabelText('Hora')).toHaveProp('value', '10');
    expect(getByLabelText('Minuto')).toHaveProp('value', '30');
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

  it('does not offer a year change unless year selection is enabled', async () => {
    const { getByText, queryByLabelText } = await render(
      <DateField label="Fecha de salida" value="10/10/2026" yearSelection={false} />,
    );

    await fireEvent.press(getByText('10/10/2026'));

    expect(queryByLabelText('Cambiar año')).toBeNull();
  });

  it('changes the year from a year list when year selection is enabled', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText, queryByLabelText } = await render(
      <DateField label="Fecha de salida" value="10/10/2026" onChange={onChange} yearSelection />,
    );

    await fireEvent.press(getByText('10/10/2026'));
    await fireEvent.press(getByLabelText('Cambiar año'));

    expect(getByText('2021 a 2032')).toBeTruthy();

    await fireEvent.press(getByLabelText('Años siguientes'));
    expect(getByText('2033 a 2044')).toBeTruthy();

    await fireEvent.press(getByLabelText('Años anteriores'));
    await fireEvent.press(getByLabelText('Año 2024'));

    expect(getByText('Octubre 2024')).toBeTruthy();
    expect(queryByLabelText('Año 2024')).toBeNull();

    await fireEvent.press(getByLabelText('15 de octubre de 2024'));

    expect(onChange).toHaveBeenCalledWith('15/10/2024');
  });

  it('returns to the month without changing the year', async () => {
    const { getByLabelText, getByText, queryByText } = await render(
      <DateField label="Fecha de salida" value="10/10/2026" yearSelection />,
    );

    await fireEvent.press(getByText('10/10/2026'));
    await fireEvent.press(getByLabelText('Cambiar año'));
    await fireEvent.press(getByLabelText('Volver al mes'));

    expect(getByText('Octubre 2026')).toBeTruthy();
    expect(queryByText('2021 a 2032')).toBeNull();
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
