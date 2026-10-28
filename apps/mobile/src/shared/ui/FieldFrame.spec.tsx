import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FieldFrame } from './FieldFrame';

describe('FieldFrame', () => {
  it('keeps the testID on the visual control when the field does not open anything', async () => {
    const { getAllByTestId, getByTestId } = await render(
      <FieldFrame label="Nombre" testID="quote-nombre">
        <Text>María</Text>
      </FieldFrame>,
    );

    const field = getByTestId('quote-nombre');

    expect(getAllByTestId('quote-nombre')).toHaveLength(1);
    expect(field.props.onPress).toBeUndefined();
    expect(field.props.accessibilityRole).toBeUndefined();
    expect(field.props.accessibilityActions).toBeUndefined();
    expect(field.props.onAccessibilityAction).toBeUndefined();
    expect(field).toHaveTextContent('María');
  });

  it('puts the testID on the visual control when the field opens on press', async () => {
    const onPress = jest.fn();
    const { getAllByTestId, getByTestId } = await render(
      <FieldFrame label="Destino" testID="quote-field-destino" onPress={onPress}>
        <Text>España</Text>
      </FieldFrame>,
    );

    const field = getByTestId('quote-field-destino');

    expect(getAllByTestId('quote-field-destino')).toHaveLength(1);
    expect(field.props.accessibilityRole).toBe('button');
    expect(field).toHaveTextContent('España');

    await fireEvent.press(field);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('runs the press handler once when accessibility activate is invoked', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <FieldFrame label="Destino" testID="quote-field-destino" onPress={onPress}>
        <Text>España</Text>
      </FieldFrame>,
    );

    const field = getByTestId('quote-field-destino');

    expect(field.props.accessible).toBe(true);
    expect(field.props.accessibilityActions).toEqual([{ name: 'activate' }]);

    await fireEvent(field, 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('leaves the press handler untouched for another accessibility action', async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <FieldFrame label="Destino" testID="quote-field-destino" onPress={onPress}>
        <Text>España</Text>
      </FieldFrame>,
    );

    await fireEvent(getByTestId('quote-field-destino'), 'accessibilityAction', {
      nativeEvent: { actionName: 'longpress' },
    });

    expect(onPress).not.toHaveBeenCalled();
  });
});
