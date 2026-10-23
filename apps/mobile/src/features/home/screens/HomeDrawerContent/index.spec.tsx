import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { type DrawerContentComponentProps } from '@react-navigation/drawer';

import { useSessionStore } from '../../../session/store/useSessionStore';
import HomeDrawerContent from './index';

jest.mock('@react-navigation/drawer', () => {
  const React = require('react');
  return {
    DrawerContentScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('DrawerContentScrollView', null, children),
  };
});

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  return { useNavigation: () => ({ navigate }) };
});

const closeDrawer = jest.fn();
const props = { navigation: { closeDrawer } } as unknown as DrawerContentComponentProps;

describe('HomeDrawerContent', () => {
  beforeEach(() => {
    closeDrawer.mockClear();
    useNavigation().navigate.mockClear();
    useSessionStore.setState({
      firstName: 'Ana',
      lastName: 'Rojas',
      email: 'ana@solventa.test',
    });
  });

  it('shows the signed-in name, last name, and email', async () => {
    const { getByText } = await render(<HomeDrawerContent {...props} />);

    expect(getByText('Ana Rojas')).toBeTruthy();
    expect(getByText('ana@solventa.test')).toBeTruthy();
    expect(getByText('Cerrar sesión')).toBeTruthy();
  });

  it('closes the drawer and opens the settings screen from its entry', async () => {
    const { getByText } = await render(<HomeDrawerContent {...props} />);

    await fireEvent.press(getByText('Ajustes'));

    expect(closeDrawer).toHaveBeenCalled();
    expect(useNavigation().navigate).toHaveBeenCalledWith('Settings');
  });

  it('shows the email when the name has not loaded', async () => {
    useSessionStore.setState({ firstName: null, lastName: null, email: 'ana@solventa.test' });
    const { getByText, queryByText } = await render(<HomeDrawerContent {...props} />);

    expect(queryByText('Ana Rojas')).toBeNull();
    expect(getByText('ana@solventa.test')).toBeTruthy();
    expect(getByText('Cerrar sesión')).toBeTruthy();
  });
});
