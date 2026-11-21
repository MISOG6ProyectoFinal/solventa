import { render } from '@testing-library/react-native';

import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  it('shows the message once, without a second label on the spinner', async () => {
    const { getByText, getByTestId, queryByLabelText } = await render(
      <LoadingState testID="loading" label="Cargando reportes..." />,
    );

    expect(getByText('Cargando reportes...')).toBeTruthy();
    expect(queryByLabelText('Cargando reportes...')).toBeNull();
    expect(getByTestId('loading')).toBeTruthy();
  });
});
