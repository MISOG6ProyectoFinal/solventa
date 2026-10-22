import { fireEvent, render } from '@testing-library/react-native';

import { ChipSelector } from './ChipSelector';

const OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'grua', label: 'Grúas' },
  { id: 'taller', label: 'Talleres' },
];

describe('ChipSelector', () => {
  it('marks only the chosen chip as selected', async () => {
    const { getByTestId } = await render(<ChipSelector options={OPTIONS} value="grua" onChange={jest.fn()} />);

    expect(getByTestId('chip-grua').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('chip-all').props.accessibilityState).toEqual({ selected: false });
    expect(getByTestId('chip-taller').props.accessibilityState).toEqual({ selected: false });
  });

  it('still reports a chip pressed with its press animation running', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<ChipSelector options={OPTIONS} value="all" onChange={onChange} />);

    await fireEvent(getByTestId('chip-grua'), 'pressIn');
    await fireEvent(getByTestId('chip-grua'), 'pressOut');
    await fireEvent.press(getByTestId('chip-grua'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('grua');
  });

  it('reports the pressed chip', async () => {
    const onChange = jest.fn();
    const { getByText } = await render(<ChipSelector options={OPTIONS} value="all" onChange={onChange} />);

    await fireEvent.press(getByText('Talleres'));

    expect(onChange).toHaveBeenCalledWith('taller');
  });
});
