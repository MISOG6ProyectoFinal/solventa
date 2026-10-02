import { fireEvent, render } from '@testing-library/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { SelectField } from './SelectField';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

const options = [
  { value: 'es', label: 'España' },
  { value: 'mx', label: 'México' },
];

describe('SelectField', () => {
  it('shows the placeholder until a value is chosen', async () => {
    const { getByText, queryByText } = await render(
      <SelectField label="Destino" options={options} />,
    );

    expect(getByText('Selecciona')).toBeTruthy();
    expect(queryByText('España')).toBeNull();
    expect(queryByText('México')).toBeNull();
  });

  it('shows the selected option', async () => {
    const { getByText, queryByText } = await render(
      <SelectField label="Destino" value="es" options={options} />,
    );

    expect(getByText('España')).toBeTruthy();
    expect(queryByText('Selecciona')).toBeNull();
  });

  it('shows the required message when the field has an error', async () => {
    const { getByText } = await render(<SelectField label="Destino" options={options} error />);

    expect(getByText('Obligatorio')).toBeTruthy();
  });

  it('chooses an option and closes the list', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText, queryByLabelText } = await render(
      <SelectField label="Destino" options={options} onChange={onChange} />,
    );

    await fireEvent.press(getByText('Selecciona'));

    expect(getByLabelText('España')).toBeTruthy();
    expect(getByLabelText('México').props.accessibilityState).toEqual({ selected: false });

    await fireEvent.press(getByLabelText('México'));

    expect(onChange).toHaveBeenCalledWith('mx');
    expect(queryByLabelText('México')).toBeNull();
  });

  it('keeps the list above the bottom inset', async () => {
    const { getByTestId, getByText } = await render(
      <SelectField label="Destino" options={options} />,
    );

    await fireEvent.press(getByText('Selecciona'));

    expect(getByTestId('select-sheet')).toHaveStyle({
      paddingBottom: useSafeAreaInsets().bottom + theme.space.lg,
    });
  });
});
