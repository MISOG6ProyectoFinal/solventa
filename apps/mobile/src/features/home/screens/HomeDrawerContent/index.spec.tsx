import { render } from '@testing-library/react-native';
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

const props = {} as DrawerContentComponentProps;

describe('HomeDrawerContent', () => {
  beforeEach(() => {
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

  it('shows the email when the name has not loaded', async () => {
    useSessionStore.setState({ firstName: null, lastName: null, email: 'ana@solventa.test' });
    const { getByText, queryByText } = await render(<HomeDrawerContent {...props} />);

    expect(queryByText('Ana Rojas')).toBeNull();
    expect(getByText('ana@solventa.test')).toBeTruthy();
    expect(getByText('Cerrar sesión')).toBeTruthy();
  });
});
