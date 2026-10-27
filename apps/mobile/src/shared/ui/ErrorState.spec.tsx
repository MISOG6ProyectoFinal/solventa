import { fireEvent, render } from '@testing-library/react-native';

import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('shows the message without a button when there is nothing to retry', async () => {
    const { getByText, queryByText } = await render(<ErrorState message="No se pudo cargar." />);

    expect(getByText('No se pudo cargar.')).toBeTruthy();
    expect(queryByText('Reintentar')).toBeNull();
  });

  it('offers a retry button that runs the retry', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <ErrorState message="No se pudo cargar." retry={{ label: 'Reintentar', onPress }} />,
    );

    await fireEvent.press(getByText('Reintentar'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
