import { fireEvent, render } from '@testing-library/react-native';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('shows only the message when there is no action', async () => {
    const { getByText, queryByRole } = await render(<EmptyState message="Aún no tienes reportes." />);

    expect(getByText('Aún no tienes reportes.')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });

  it('offers an action button that runs the action', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <EmptyState message="Aún no tienes reportes." action={{ label: 'Reportar siniestro', onPress }} />,
    );

    await fireEvent.press(getByText('Reportar siniestro'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
