import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { getApiBaseUrl, getBuildApiBaseUrl, selectBuildApi } from '../../../../shared/api/apiBaseUrl';
import DevToolsScreen from './index';

const buildUrl = getBuildApiBaseUrl();

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      canGoBack: () => true,
      goBack: jest.fn(),
    }),
  };
});

describe('DevToolsScreen', () => {
  beforeEach(() => {
    selectBuildApi();
  });

  it('uses the build API by default', async () => {
    const { getByText, queryByLabelText } = await render(<DevToolsScreen />);

    expect(getByText(`En uso: ${buildUrl}`)).toBeTruthy();
    expect(getByText(`URL del build: ${buildUrl}`)).toBeTruthy();
    expect(queryByLabelText('URL')).toBeNull();
  });

  it('points to the URL typed in the custom field', async () => {
    const { getByText, getByLabelText } = await render(<DevToolsScreen />);

    await fireEvent.press(getByText('Personalizada'));
    await fireEvent.changeText(getByLabelText('URL'), 'http://192.168.1.20:8000/');

    expect(getApiBaseUrl()).toBe('http://192.168.1.20:8000');
    expect(getByText('En uso: http://192.168.1.20:8000')).toBeTruthy();
  });

  it('flags an invalid URL and keeps the previous one', async () => {
    const { getByText, getByLabelText } = await render(<DevToolsScreen />);

    await fireEvent.press(getByText('Personalizada'));
    const previous = getApiBaseUrl();
    await fireEvent.changeText(getByLabelText('URL'), '192.168.1.20');

    expect(getByText('Ingresa una URL que empiece por http:// o https://')).toBeTruthy();
    expect(getApiBaseUrl()).toBe(previous);
  });

  it('goes back to the build API', async () => {
    const { getByText } = await render(<DevToolsScreen />);

    await fireEvent.press(getByText('Personalizada'));
    await fireEvent.press(getByText('Del build'));

    expect(getApiBaseUrl()).toBe(buildUrl);
  });

  it('opens the component list', async () => {
    const { getByText } = await render(<DevToolsScreen />);

    await fireEvent.press(getByText('Componentes'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('Components');
  });
});
