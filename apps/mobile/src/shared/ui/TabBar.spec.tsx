import { fireEvent, render } from '@testing-library/react-native';

import { theme } from '../theme';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('lists the four destinations and reports the one that is pressed', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByTestId } = await render(<TabBar value="Home" onChange={onChange} />);

    expect(getByTestId('tab-bar')).toHaveStyle({ backgroundColor: theme.colors.navy });
    expect(getByLabelText('Inicio').props.accessibilityState).toEqual({ selected: true });
    expect(getByLabelText('Pólizas')).toBeTruthy();
    expect(getByLabelText('Siniestros')).toBeTruthy();
    expect(getByLabelText('Comprar')).toBeTruthy();

    await fireEvent.press(getByLabelText('Pólizas'));

    expect(onChange).toHaveBeenCalledWith('Policies');
  });
});
