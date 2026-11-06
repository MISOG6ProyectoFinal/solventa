import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '../../core/constants/api-endpoints.constants';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { LocaleService } from '../../core/services/locale.service';
import { signOut } from '../../core/testing/auth.testing';
import { LoginPageComponent } from './login-page.component';

const LOGIN_RESPONSE = {
  token: 'jwt-token',
  operador: { id: 'op-1', correo: 'ana@solventa.co', nombre: 'Ana Gómez', roles: ['administrador'], activo: true, creado_en: '2026-09-01T10:00:00Z' },
};

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  const type = async (testId: string, value: string): Promise<void> => {
    const input = el.querySelector<HTMLInputElement>(`[data-testid=${testId}]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const submitButton = (): HTMLButtonElement => el.querySelector<HTMLButtonElement>('[data-testid=login-submit]')!;
  const submit = async (email = 'ana@solventa.co', password = 'secreto-123'): Promise<void> => {
    await type('login-email', email);
    await type('login-password', password);
    submitButton().click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPageComponent);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    signOut();
    TestBed.inject(LocaleService).setLocale('es');
  });

  it('goes to operations after signing in', async () => {
    await submit();

    http.expectOne({ method: 'POST', url: API_ENDPOINTS.session.login }).flush(LOGIN_RESPONSE);
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/ops');
    expect(sessionStorage.getItem('slv.access_token')).toBe('jwt-token');
  });

  it('goes back to the page the operator was trying to open', async () => {
    fixture.componentRef.setInput('returnUrl', '/partners');
    await submit();

    http.expectOne(API_ENDPOINTS.session.login).flush(LOGIN_RESPONSE);

    expect(navigateByUrl).toHaveBeenCalledWith('/partners');
  });

  it('ignores a return address that leaves the portal', async () => {
    fixture.componentRef.setInput('returnUrl', '//sitio-externo.test');
    await submit();

    http.expectOne(API_ENDPOINTS.session.login).flush(LOGIN_RESPONSE);

    expect(navigateByUrl).toHaveBeenCalledWith('/ops');
  });

  it('shows the message of the backend when the credentials are wrong', async () => {
    await submit();

    http
      .expectOne(API_ENDPOINTS.session.login)
      .flush(
        { detail: { codigo: 'credenciales_invalidas', mensaje: 'Correo o contraseña incorrectos.' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();

    expect(el.querySelector('[data-testid=login-error]')?.textContent).toContain('Correo o contraseña incorrectos.');
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it('shows a general message when the backend fails', async () => {
    await submit();

    http.expectOne(API_ENDPOINTS.session.login).flush({ detail: 'Servicio interno no disponible' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    expect(el.textContent).toContain('No fue posible iniciar sesión. Intente de nuevo.');
  });

  it('disables the button while the request is in flight', async () => {
    await submit();

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain('Ingresando…');
    submitButton().click();
    http.expectOne(API_ENDPOINTS.session.login).flush(LOGIN_RESPONSE);
  });

  it('validates the fields before calling the backend', async () => {
    await submit('sin-arroba', '');

    expect(el.textContent).toContain('Correo inválido');
    expect(el.textContent).toContain('Requerido');
    http.expectNone(API_ENDPOINTS.session.login);
  });

  it('shows the page in English when the language changes', async () => {
    TestBed.inject(LocaleService).setLocale('en');
    await fixture.whenStable();

    expect(el.querySelector('h1')?.textContent).toContain('Sign in');
    expect(submitButton().textContent).toContain('Sign in');
  });
});
