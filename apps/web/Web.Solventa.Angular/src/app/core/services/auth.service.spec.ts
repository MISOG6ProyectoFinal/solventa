import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { STORAGE_KEYS } from '../constants/storage-keys.constants';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { ApiError } from '../interfaces/api-response.interface';
import { signInAs, signOut } from '../testing/auth.testing';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

const LOGIN_RESPONSE = {
  token: 'jwt-token',
  operador: {
    id: 'op-1',
    correo: 'ana@solventa.co',
    nombre: 'Ana Gómez',
    roles: ['asesor', 'desconocido'],
    activo: true,
    creado_en: '2026-09-01T10:00:00Z',
  },
};

describe('AuthService', () => {
  let http: HttpTestingController;

  const create = (): AuthService => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  };

  afterEach(() => {
    http.verify();
    signOut();
  });

  it('starts without a session', () => {
    const auth = create();

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.operator()).toBeNull();
    expect(auth.roles()).toEqual([]);
    expect(TestBed.inject(SessionService).userName()).toBe('');
  });

  it('signs in, keeps the token and the operator and exposes their roles', () => {
    const auth = create();

    auth.login('ana@solventa.co', 'secreto-123').subscribe();
    const request = http.expectOne({ method: 'POST', url: API_ENDPOINTS.session.login });
    expect(request.request.body).toEqual({ correo: 'ana@solventa.co', contrasena: 'secreto-123' });
    request.flush(LOGIN_RESPONSE);

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.operator()).toEqual({ id: 'op-1', email: 'ana@solventa.co', name: 'Ana Gómez', roles: ['asesor'] });
    expect(auth.roles()).toEqual(['asesor']);
    expect(sessionStorage.getItem(STORAGE_KEYS.accessToken)).toBe('jwt-token');
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.operator)!)).toMatchObject({ name: 'Ana Gómez' });
    expect(TestBed.inject(SessionService).userName()).toBe('Ana Gómez');
  });

  it('does not open a session when the credentials are wrong', () => {
    const auth = create();
    let failure!: ApiError;

    auth.login('ana@solventa.co', 'mala').subscribe({ error: (error: ApiError) => (failure = error) });
    http
      .expectOne(API_ENDPOINTS.session.login)
      .flush(
        { detail: { codigo: 'credenciales_invalidas', mensaje: 'Correo o contraseña incorrectos.' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(failure).toMatchObject({ status: 401, message: 'Correo o contraseña incorrectos.' });
    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
  });

  it('clears the token and the operator when signing out', () => {
    signInAs(['administrador']);
    const auth = create();

    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.operator()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.operator)).toBeNull();
  });

  it('restores the session from sessionStorage on startup', () => {
    signInAs(['consulta'], 'Marta Rojas');
    const auth = create();

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.operator()?.name).toBe('Marta Rojas');
    expect(auth.roles()).toEqual(['consulta']);
  });

  it('ignores a stored operator without token or with corrupt data', () => {
    sessionStorage.setItem(STORAGE_KEYS.operator, JSON.stringify({ id: 'op-1', name: 'Ana', roles: ['asesor'] }));
    expect(create().isAuthenticated()).toBe(false);

    TestBed.resetTestingModule();
    sessionStorage.setItem(STORAGE_KEYS.accessToken, 'jwt-token');
    sessionStorage.setItem(STORAGE_KEYS.operator, '{no es json');
    expect(create().isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
  });

  it('tells whether the operator has at least one of the roles', () => {
    signInAs(['asesor']);
    const auth = create();

    expect(auth.hasRole('asesor')).toBe(true);
    expect(auth.hasRole('administrador', 'asesor')).toBe(true);
    expect(auth.hasRole('administrador', 'consulta')).toBe(false);
    expect(auth.hasRole()).toBe(false);
  });
});
