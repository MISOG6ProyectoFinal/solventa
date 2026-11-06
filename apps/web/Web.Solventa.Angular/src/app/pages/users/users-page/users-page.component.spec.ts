import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { LocaleService } from '../../../core/services/locale.service';
import { signInAs, signOut } from '../../../core/testing/auth.testing';
import { ADMIN_DTO, ADVISOR_DTO, INACTIVE_DTO } from '../testing/operator.fixtures';
import { UsersPageComponent } from './users-page.component';

describe('UsersPageComponent', () => {
  let fixture: ComponentFixture<UsersPageComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;

  const button = (text: string, root: ParentNode = el): HTMLButtonElement =>
    Array.from(root.querySelectorAll('button')).find((item) => item.textContent?.includes(text))!;
  const row = (operatorId: string): HTMLElement => el.querySelector<HTMLElement>(`[data-operator=${operatorId}]`)!;
  const dialog = (): HTMLElement => el.querySelector<HTMLElement>('[role=dialog]')!;
  const type = async (testId: string, value: string): Promise<void> => {
    const input = el.querySelector<HTMLInputElement>(`[data-testid=${testId}]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const loadOperators = async (): Promise<void> => {
    http.expectOne(API_ENDPOINTS.operators).flush([ADMIN_DTO, ADVISOR_DTO, INACTIVE_DTO]);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    signInAs(['administrador'], 'Ana Gómez', 'op-1');
    await TestBed.configureTestingModule({
      imports: [UsersPageComponent],
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UsersPageComponent);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    signOut();
    TestBed.inject(LocaleService).setLocale('es');
  });

  it('lists the operators with their roles and state', async () => {
    await loadOperators();

    expect(row('op-2').textContent).toContain('Luis Pérez');
    expect(row('op-2').textContent).toContain('luis@solventa.co');
    expect(row('op-2').textContent).toContain('Asesor');
    expect(row('op-2').textContent).toContain('Activo');
    expect(row('op-3').textContent).toContain('Consulta');
    expect(row('op-3').textContent).toContain('Inactivo');
  });

  it('shows the loading state and an empty list', async () => {
    expect(el.textContent).toContain('Cargando operadores…');

    http.expectOne(API_ENDPOINTS.operators).flush([]);
    await fixture.whenStable();

    expect(el.textContent).toContain('Aún no hay operadores.');
  });

  it('offers a retry when the operators cannot be loaded', async () => {
    http.expectOne(API_ENDPOINTS.operators).flush({ detail: 'Servicio interno no disponible' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    expect(el.textContent).toContain('No fue posible cargar los operadores.');
    button('Reintentar').click();
    await loadOperators();

    expect(row('op-1')).toBeTruthy();
  });

  it('shows the page in English when the language changes', async () => {
    await loadOperators();
    TestBed.inject(LocaleService).setLocale('en');
    await fixture.whenStable();

    expect(el.querySelector('h1')?.textContent).toContain('Users');
    expect(el.textContent).toContain('New operator');
    expect(row('op-2').textContent).toContain('Advisor');
    expect(row('op-3').textContent).toContain('Inactive');
  });

  it('creates an operator and shows it in the list', async () => {
    await loadOperators();
    button('Nuevo operador').click();
    await fixture.whenStable();
    await type('operator-name', 'Pedro Gil');
    await type('operator-email', 'pedro@solventa.co');
    await type('operator-password', 'secreto-123');
    dialog().querySelector<HTMLInputElement>('[data-role=asesor]')!.click();
    await fixture.whenStable();

    button('Crear operador', dialog()).click();
    const request = http.expectOne({ method: 'POST', url: API_ENDPOINTS.operators });
    expect(request.request.body).toEqual({
      correo: 'pedro@solventa.co',
      nombre: 'Pedro Gil',
      roles: ['consulta', 'asesor'],
      contrasena: 'secreto-123',
    });
    request.flush({ ...ADVISOR_DTO, id: 'op-4', correo: 'pedro@solventa.co', nombre: 'Pedro Gil', roles: ['consulta', 'asesor'] }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(el.querySelector('[role=dialog]')).toBeNull();
    expect(row('op-4').textContent).toContain('Pedro Gil');
  });

  it('validates the new operator before calling the backend', async () => {
    await loadOperators();
    button('Nuevo operador').click();
    await fixture.whenStable();
    await type('operator-email', 'sin-arroba');
    await type('operator-password', 'corta');
    dialog().querySelector<HTMLInputElement>('[data-role=consulta]')!.click();
    await fixture.whenStable();

    button('Crear operador', dialog()).click();
    await fixture.whenStable();

    expect(dialog().textContent).toContain('Requerido');
    expect(dialog().textContent).toContain('Correo inválido');
    expect(dialog().textContent).toContain('Use al menos 8 caracteres');
    expect(dialog().textContent).toContain('Seleccione al menos un rol');
    http.expectNone(API_ENDPOINTS.operators);
  });

  it.each([
    [409, 'Ya existe un operador con ese correo.'],
    [422, 'La contraseña es demasiado débil.'],
  ])('shows the message of the backend on a %i', async (status, message) => {
    await loadOperators();
    button('Nuevo operador').click();
    await fixture.whenStable();
    await type('operator-name', 'Pedro Gil');
    await type('operator-email', 'pedro@solventa.co');
    await type('operator-password', 'secreto-123');

    button('Crear operador', dialog()).click();
    http.expectOne({ method: 'POST', url: API_ENDPOINTS.operators }).flush({ detail: { codigo: 'rechazado', mensaje: message } }, { status, statusText: 'Error' });
    await fixture.whenStable();

    expect(dialog().textContent).toContain(message);
    expect(button('Crear operador', dialog()).disabled).toBe(false);
  });

  it('activates and deactivates an operator', async () => {
    await loadOperators();

    button('Desactivar', row('op-2')).click();
    const deactivate = http.expectOne({ method: 'PATCH', url: API_ENDPOINTS.operator('op-2') });
    expect(deactivate.request.body).toEqual({ activo: false });
    deactivate.flush({ ...ADVISOR_DTO, activo: false });
    await fixture.whenStable();
    expect(row('op-2').textContent).toContain('Inactivo');

    button('Activar', row('op-3')).click();
    const activate = http.expectOne({ method: 'PATCH', url: API_ENDPOINTS.operator('op-3') });
    expect(activate.request.body).toEqual({ activo: true });
    activate.flush({ ...INACTIVE_DTO, activo: true });
    await fixture.whenStable();
    expect(row('op-3').textContent).toContain('Activo');
  });

  it('shows why an operator could not be updated', async () => {
    await loadOperators();

    button('Desactivar', row('op-2')).click();
    http
      .expectOne(API_ENDPOINTS.operator('op-2'))
      .flush({ detail: { codigo: 'permiso_denegado', mensaje: 'No tiene permiso.' } }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(el.textContent).toContain('No tiene permiso.');
    expect(row('op-2').textContent).toContain('Activo');
  });

  it('edits the roles of an operator', async () => {
    await loadOperators();

    button('Editar roles', row('op-2')).click();
    await fixture.whenStable();
    expect(dialog().textContent).toContain('Roles de Luis Pérez');
    expect(dialog().querySelector<HTMLInputElement>('[data-role=asesor]')!.checked).toBe(true);
    dialog().querySelector<HTMLInputElement>('[data-role=consulta]')!.click();
    await fixture.whenStable();

    button('Guardar roles', dialog()).click();
    const request = http.expectOne({ method: 'PATCH', url: API_ENDPOINTS.operator('op-2') });
    expect(request.request.body).toEqual({ roles: ['asesor', 'consulta'] });
    request.flush({ ...ADVISOR_DTO, roles: ['asesor', 'consulta'] });
    await fixture.whenStable();

    expect(el.querySelector('[role=dialog]')).toBeNull();
    expect(row('op-2').textContent).toContain('Consulta');
  });

  it('does not save an operator without roles', async () => {
    await loadOperators();
    button('Editar roles', row('op-2')).click();
    await fixture.whenStable();
    dialog().querySelector<HTMLInputElement>('[data-role=asesor]')!.click();
    await fixture.whenStable();

    button('Guardar roles', dialog()).click();
    await fixture.whenStable();

    expect(dialog().textContent).toContain('Seleccione al menos un rol');
    http.expectNone(API_ENDPOINTS.operator('op-2'));
  });

  it('does not let the administrator lock themselves out', async () => {
    await loadOperators();

    expect(row('op-1').textContent).toContain('(usted)');
    expect(button('Desactivar', row('op-1')).disabled).toBe(true);
    expect(button('Editar roles', row('op-1')).disabled).toBe(true);
    expect(button('Desactivar', row('op-2')).disabled).toBe(false);
  });
});
