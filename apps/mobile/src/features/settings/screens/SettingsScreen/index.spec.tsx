import { fireEvent, render } from '@testing-library/react-native';

import { useLanguageStore } from '../../../../shared/i18n/useLanguageStore';
import SettingsScreen from './index';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }),
}));

describe('SettingsScreen', () => {
  it('offers both languages, each in its own language', async () => {
    const { getByText } = await render(<SettingsScreen />);

    expect(getByText('Ajustes')).toBeTruthy();
    expect(getByText('Idioma')).toBeTruthy();
    expect(getByText('Español')).toBeTruthy();
    expect(getByText('English')).toBeTruthy();
  });

  it('switches the screen to English and back without leaving it', async () => {
    const { getByText, queryByText } = await render(<SettingsScreen />);

    await fireEvent.press(getByText('English'));

    expect(useLanguageStore.getState().language).toBe('en');
    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('Language')).toBeTruthy();
    expect(queryByText('Ajustes')).toBeNull();

    await fireEvent.press(getByText('Español'));

    expect(useLanguageStore.getState().language).toBe('es');
    expect(getByText('Ajustes')).toBeTruthy();
  });
});
