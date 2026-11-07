import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { STORAGE_KEYS } from '../constants/storage-keys.constants';
import { signInAs, signOut } from '../testing/auth.testing';
import { AuthService } from '../services/auth.service';
import { errorInterceptor } from './error.interceptor';
import { sessionExpiredInterceptor } from './session-expired.interceptor';

describe('sessionExpiredInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let auth: AuthService;
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    signInAs(['administrador']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([sessionExpiredInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    signOut();
  });

  const fail = (url: string, status: number): void => {
    client.get(url).subscribe({ error: () => undefined });
    http.expectOne(url).flush({ detail: { codigo: 'sesion_invalida', mensaje: 'Sesión vencida' } }, { status, statusText: 'Error' });
  };

  it('signs out and goes to the login on a 401 from the API', () => {
    fail(API_ENDPOINTS.partners, 401);

    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('remembers the page the operator was on', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/partners');

    fail(API_ENDPOINTS.partners, 401);

    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/partners' } });
  });

  it('does nothing when the failed call is the login itself', () => {
    fail(API_ENDPOINTS.session.login, 401);

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the session on other errors', () => {
    fail(API_ENDPOINTS.partners, 403);
    fail(API_ENDPOINTS.partners, 500);

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores a 401 from a service that is not the API', () => {
    fail('https://otro-servicio.test/datos', 401);

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
