import { fireEvent, render } from '@testing-library/react-native';

import { AppText } from './AppText';
import { Card } from './Card';

describe('Card', () => {
  it('stays static unless a press handler is provided', async () => {
    const onPress = jest.fn();
    const quiet = await render(
      <Card testID="card">
        <AppText>Resumen</AppText>
      </Card>,
    );

    expect(quiet.getByTestId('card').props.accessibilityRole).toBeUndefined();

    const pressable = await render(
      <Card testID="card" onPress={onPress}>
        <AppText>Siniestros</AppText>
      </Card>,
    );

    expect(pressable.getByTestId('card').props.accessibilityRole).toBe('button');

    await fireEvent.press(pressable.getByText('Siniestros'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps a disabled card from being selected', async () => {
    const { getByTestId } = await render(
      <Card testID="card" disabled>
        <AppText>Próximamente</AppText>
      </Card>,
    );

    expect(getByTestId('card').props.accessibilityRole).toBe('button');
    expect(getByTestId('card').props.accessibilityState).toEqual({ disabled: true });
    expect(getByTestId('card')).toHaveStyle({ opacity: 0.5 });
    expect(getByTestId('card').props.onPress).toBeUndefined();
  });
});
