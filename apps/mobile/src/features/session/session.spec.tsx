import { useState } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { type DrawerContentComponentProps } from '@react-navigation/drawer';

import { setAccessToken } from '../../shared/api/accessToken';
import { apiClient } from '../../shared/api/client';
import HomeDrawerContent from '../home/screens/HomeDrawerContent';
import HomeScreen from '../home/screens/HomeScreen';
import CheckingScreen from './screens/CheckingScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import * as storage from './storage';
import { useSessionStore } from './store/useSessionStore';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/drawer', () => {
  const React = require('react');
  return {
    DrawerContentScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('DrawerContentScrollView', null, children),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    canGoBack: () => false,
  }),
}));

jest.mock('./storage', () => ({
  readToken: jest.fn(),
  saveToken: jest.fn(),
  deleteToken: jest.fn(),
}));

const CORREO = 'ana@solventa.test';
const CONTRASENA = 'clave-nueva';
const NOMBRE = 'Ana';
const APELLIDO = 'Rojas';
const TOKEN = 'token-firmado';
const CLIENTE = 'cliente-1';
const GREETING = `Hola, ${NOMBRE}`;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function sessionResponse(status = 200) {
  return jsonResponse({ token: TOKEN, cliente_id: CLIENTE }, status);
}

function profileResponse() {
  return jsonResponse({
    cliente_id: CLIENTE,
    correo: CORREO,
    nombre: NOMBRE,
    apellido: APELLIDO,
  });
}

function installFetch() {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/movil/sesion') && (init?.method === undefined || init.method === 'GET')) {
      return profileResponse();
    }
    return sessionResponse();
  }) as typeof fetch;
}

function Shell() {
  const status = useSessionStore((state) => state.status);
  const [route, setRoute] = useState('Login');
  mockNavigate.mockImplementation((name: string) => setRoute(name));

  if (status === 'checking') {
    return <CheckingScreen />;
  }
  if (status === 'signedIn') {
    return (
      <>
        <HomeScreen />
        <HomeDrawerContent {...({} as DrawerContentComponentProps)} />
      </>
    );
  }
  if (route === 'Register') {
    return <RegisterScreen />;
  }
  return <LoginScreen />;
}

async function openLogin() {
  const view = await render(<Shell />);
  await waitFor(() => expect(view.getAllByText('Iniciar sesión').length).toBeGreaterThan(0));
  return view;
}

async function pressLabel(view: { getAllByText: (text: string) => Array<{ props: unknown }> }, label: string) {
  const matches = view.getAllByText(label);
  await fireEvent.press(matches[matches.length - 1]);
}

describe('sesión del cliente', () => {
  let saved: string | null;

  beforeEach(() => {
    saved = null;
    jest.mocked(storage.readToken).mockImplementation(async () => saved);
    jest.mocked(storage.saveToken).mockImplementation(async (token: string) => {
      saved = token;
    });
    jest.mocked(storage.deleteToken).mockImplementation(async () => {
      saved = null;
    });
    setAccessToken(null);
    useSessionStore.setState({
      status: 'checking',
      clienteId: null,
      email: null,
      firstName: null,
      lastName: null,
    });
    installFetch();
  });

  it('shows a blank screen while the stored token is still loading', async () => {
    let resolveToken: (token: string | null) => void = () => undefined;
    jest.mocked(storage.readToken).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
    );

    const view = await render(<Shell />);

    expect(view.queryByText('Iniciar sesión')).toBeNull();
    expect(view.queryByText(GREETING)).toBeNull();

    resolveToken(null);
    await waitFor(() => expect(view.getAllByText('Iniciar sesión').length).toBeGreaterThan(0));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts the trimmed email and opens Inicio', async () => {
    const view = await openLogin();

    expect(view.getByText('Solventa')).toBeTruthy();
    expect(view.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
    expect(view.getByLabelText('Correo').props.autoCapitalize).toBe('none');

    await fireEvent.changeText(view.getByLabelText('Correo'), `  ${CORREO}  `);
    await fireEvent.changeText(view.getByLabelText('Contraseña'), CONTRASENA);
    await pressLabel(view, 'Iniciar sesión');

    await waitFor(() => expect(view.getByText(GREETING)).toBeTruthy());
    expect(view.queryByText('Iniciar sesión')).toBeNull();

    const calls = jest.mocked(fetch).mock.calls;
    const [url, init] = calls[0];
    expect(String(url)).toMatch(/\/movil\/sesiones$/);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: CORREO, contrasena: CONTRASENA }),
    });
    const [profileUrl, profileInit] = calls[1];
    expect(String(profileUrl)).toMatch(/\/movil\/sesion$/);
    expect(profileInit).toEqual({
      method: 'GET',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: undefined,
    });
    expect(useSessionStore.getState()).toMatchObject({
      email: CORREO,
      firstName: NOMBRE,
      lastName: APELLIDO,
    });
    expect(saved).toBe(TOKEN);
  });

  it('shows the same error for a wrong password and stays on login', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ detail: 'Correo o contraseña incorrectos' }, 401),
    ) as typeof fetch;
    const view = await openLogin();

    await fireEvent.changeText(view.getByLabelText('Correo'), CORREO);
    await fireEvent.changeText(view.getByLabelText('Contraseña'), 'otra-clave');
    await pressLabel(view, 'Iniciar sesión');

    await waitFor(() => expect(view.getByText('Correo o contraseña incorrectos')).toBeTruthy());
    expect(view.getAllByText('Iniciar sesión').length).toBeGreaterThan(0);
    expect(view.queryByText(GREETING)).toBeNull();
  });

  it('does not submit when the email or password is empty', async () => {
    const view = await openLogin();

    await pressLabel(view, 'Iniciar sesión');
    expect(view.getAllByText('Obligatorio')).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByLabelText('Correo'), CORREO);
    await pressLabel(view, 'Iniciar sesión');
    expect(view.getByText('Obligatorio')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByLabelText('Correo'), '   ');
    await fireEvent.changeText(view.getByLabelText('Contraseña'), CONTRASENA);
    await pressLabel(view, 'Iniciar sesión');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('creates an account and opens Inicio', async () => {
    const view = await openLogin();

    await pressLabel(view, 'Crear cuenta');
    await pressLabel(view, 'Crear cuenta');
    expect(view.getAllByText('Obligatorio')).toHaveLength(4);
    expect(fetch).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByLabelText('Nombre'), `  ${NOMBRE}  `);
    await fireEvent.changeText(view.getByLabelText('Apellido'), `  ${APELLIDO}  `);
    await fireEvent.changeText(view.getByLabelText('Correo'), CORREO);
    await fireEvent.changeText(view.getByLabelText('Contraseña'), CONTRASENA);
    await pressLabel(view, 'Crear cuenta');

    await waitFor(() => expect(view.getByText(GREETING)).toBeTruthy());
    const [url, init] = jest.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/movil\/registros$/);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: CORREO,
        contrasena: CONTRASENA,
        nombre: NOMBRE,
        apellido: APELLIDO,
      }),
    });
  });

  it('shows the duplicate email error and stays on Crear cuenta', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ detail: 'Ya existe una cuenta con este correo.' }, 409),
    ) as typeof fetch;
    const view = await openLogin();

    await pressLabel(view, 'Crear cuenta');
    await fireEvent.changeText(view.getByLabelText('Nombre'), NOMBRE);
    await fireEvent.changeText(view.getByLabelText('Apellido'), APELLIDO);
    await fireEvent.changeText(view.getByLabelText('Correo'), CORREO);
    await fireEvent.changeText(view.getByLabelText('Contraseña'), CONTRASENA);
    await pressLabel(view, 'Crear cuenta');

    await waitFor(() => expect(view.getByText('Ya existe una cuenta con este correo.')).toBeTruthy());
    expect(view.queryByText(GREETING)).toBeNull();

    await pressLabel(view, 'Ya tengo cuenta');
    expect(view.getAllByText('Iniciar sesión').length).toBeGreaterThan(0);
    expect(view.queryByText('Ya existe una cuenta con este correo.')).toBeNull();
  });

  it('opens Inicio when the stored token is still valid', async () => {
    saved = 'token-guardado';
    global.fetch = jest.fn(async () => profileResponse()) as typeof fetch;
    const view = await render(<Shell />);

    await waitFor(() => expect(view.getByText(GREETING)).toBeTruthy());
    expect(view.queryByText('Iniciar sesión')).toBeNull();

    const [url, init] = jest.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/movil\/sesion$/);
    expect(init).toEqual({
      method: 'GET',
      headers: { Authorization: 'Bearer token-guardado' },
      body: undefined,
    });
  });

  it('returns to login when the stored token is rejected and forgets it', async () => {
    saved = 'token-viejo';
    global.fetch = jest.fn(async () => jsonResponse({ detail: 'La sesión no es válida' }, 401)) as typeof fetch;
    const view = await render(<Shell />);

    await waitFor(() => expect(view.getAllByText('Iniciar sesión').length).toBeGreaterThan(0));
    expect(saved).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the stored token when the session check cannot reach the server', async () => {
    saved = 'token-guardado';
    global.fetch = jest.fn(async () => {
      throw new Error('network');
    }) as typeof fetch;
    const view = await render(<Shell />);

    await waitFor(() => expect(view.getByText('Hola')).toBeTruthy());
    expect(view.queryByText(GREETING)).toBeNull();
    expect(saved).toBe('token-guardado');
    expect(view.queryByText('Iniciar sesión')).toBeNull();
  });

  it('Cerrar sesión returns to login and deletes the token', async () => {
    saved = 'token-guardado';
    global.fetch = jest.fn(async () => profileResponse()) as typeof fetch;
    const view = await render(<Shell />);

    await waitFor(() => expect(view.getByText(GREETING)).toBeTruthy());
    await fireEvent.press(view.getByText('Cerrar sesión'));

    await waitFor(() => expect(view.getAllByText('Iniciar sesión').length).toBeGreaterThan(0));
    expect(saved).toBeNull();
    expect(view.queryByText(GREETING)).toBeNull();
  });

  it('returns to login and forgets the token when a later request is rejected with 401', async () => {
    saved = 'token-guardado';
    global.fetch = jest.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/movil/sesion')
        ? profileResponse()
        : jsonResponse({ detail: 'La sesión no es válida' }, 401),
    ) as typeof fetch;
    const view = await render(<Shell />);
    await waitFor(() => expect(view.getByText(GREETING)).toBeTruthy());

    await expect(apiClient.get('/movil/siniestros')).rejects.toMatchObject({ status: 401 });

    await waitFor(() => expect(view.getAllByText('Iniciar sesión').length).toBeGreaterThan(0));
    expect(saved).toBeNull();
    expect(view.queryByText(GREETING)).toBeNull();
  });
});
