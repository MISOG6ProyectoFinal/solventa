import { render } from '@testing-library/react-native';

import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  it('shows the message and labels the spinner with it', async () => {
    const { getByText, getByTestId, getByLabelText } = await render(
      <LoadingState testID="loading" label="Cargando reportes..." />,
    );

    expect(getByText('Cargando reportes...')).toBeTruthy();
    expect(getByLabelText('Cargando reportes...')).toBeTruthy();
    expect(getByTestId('loading')).toBeTruthy();
  });
});
