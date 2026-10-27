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
    expect(field).toHaveTextContent('María');
  });

  it('puts the testID on the pressable when the field opens on press', async () => {
    const onPress = jest.fn();
    const { getAllByTestId, getByTestId } = await render(
      <FieldFrame label="Destino" testID="quote-field-destino" onPress={onPress}>
        <Text>España</Text>
      </FieldFrame>,
    );

    const field = getByTestId('quote-field-destino');

    expect(getAllByTestId('quote-field-destino')).toHaveLength(1);
    expect(field.props.accessibilityRole).toBe('button');
    expect(field.props.onPress).toBe(onPress);

    await fireEvent.press(field);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
