import { render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from './Screen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

describe('Screen', () => {
  beforeEach(() => {
    jest.mocked(useNavigation).mockReturnValue({
      canGoBack: () => false,
      goBack: jest.fn(),
    } as never);
  });

  it('shows the header by default', async () => {
    const { getByTestId, getByText } = await render(<Screen header={{ title: 'Siniestros' }} />);

    expect(getByTestId('app-header')).toBeTruthy();
    expect(getByText('Siniestros')).toBeTruthy();
  });

  it('hides the header when it is turned off', async () => {
    const { queryByTestId } = await render(<Screen header={{ hide: true }} />);

    expect(queryByTestId('app-header')).toBeNull();
  });
});
