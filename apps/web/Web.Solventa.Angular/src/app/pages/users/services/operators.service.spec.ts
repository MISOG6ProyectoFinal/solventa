import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { ADMIN_DTO, ADVISOR_DTO } from '../testing/operator.fixtures';
import { OperatorsService } from './operators.service';

describe('OperatorsService', () => {
  let service: OperatorsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    service = TestBed.inject(OperatorsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the operators from the BFF', () => {
    service.load();
    expect(service.loading()).toBe(true);

    http.expectOne({ method: 'GET', url: API_ENDPOINTS.operators }).flush([ADMIN_DTO, ADVISOR_DTO]);

    expect(service.loading()).toBe(false);
    expect(service.operators()).toEqual([
      { id: 'op-1', email: 'ana@solventa.co', name: 'Ana Gómez', roles: ['administrador'], active: true, createdAt: '2026-09-01T10:00:00Z' },
      { id: 'op-2', email: 'luis@solventa.co', name: 'Luis Pérez', roles: ['asesor'], active: true, createdAt: '2026-09-02T10:00:00Z' },
    ]);
  });

  it('keeps the backend message when the list cannot be loaded', () => {
    service.load();

    http.expectOne(API_ENDPOINTS.operators).flush({ detail: { codigo: 'permiso_denegado', mensaje: 'Sin permiso' } }, { status: 403, statusText: 'Forbidden' });

    expect(service.loadError()).toBe('Sin permiso');
    expect(service.loading()).toBe(false);
  });

  it('creates an operator and adds it to the list', () => {
    let created: unknown;
    service.create({ email: 'luis@solventa.co', name: 'Luis Pérez', roles: ['asesor'], password: 'secreto-123' }).subscribe((operator) => (created = operator));

    const request = http.expectOne({ method: 'POST', url: API_ENDPOINTS.operators });
    expect(request.request.body).toEqual({ correo: 'luis@solventa.co', nombre: 'Luis Pérez', roles: ['asesor'], contrasena: 'secreto-123' });
    request.flush(ADVISOR_DTO, { status: 201, statusText: 'Created' });

    expect(created).toMatchObject({ id: 'op-2', name: 'Luis Pérez' });
    expect(service.operators().map((o) => o.id)).toEqual(['op-2']);
  });

  it('propagates the conflict when the email already exists', () => {
    let failure!: ApiError;
    service
      .create({ email: 'luis@solventa.co', name: 'Luis', roles: ['asesor'], password: 'secreto-123' })
      .subscribe({ error: (error: ApiError) => (failure = error) });

    http
      .expectOne(API_ENDPOINTS.operators)
      .flush({ detail: { codigo: 'correo_duplicado', mensaje: 'Ya existe un operador con ese correo.' } }, { status: 409, statusText: 'Conflict' });

    expect(failure).toMatchObject({ status: 409, message: 'Ya existe un operador con ese correo.' });
    expect(service.operators()).toEqual([]);
  });

  it('changes the roles and the state of an operator with PATCH', () => {
    service.load();
    http.expectOne(API_ENDPOINTS.operators).flush([ADMIN_DTO, ADVISOR_DTO]);

    service.update('op-2', { roles: ['consulta'], active: false }).subscribe();
    const request = http.expectOne({ method: 'PATCH', url: API_ENDPOINTS.operator('op-2') });
    expect(request.request.body).toEqual({ roles: ['consulta'], activo: false });
    request.flush({ ...ADVISOR_DTO, roles: ['consulta'], activo: false });

    expect(service.operators()[1]).toMatchObject({ id: 'op-2', roles: ['consulta'], active: false });
    expect(service.operators()[0].id).toBe('op-1');
  });

  it('sends only what changed', () => {
    service.update('op-2', { active: true }).subscribe();

    const request = http.expectOne(API_ENDPOINTS.operator('op-2'));
    expect(request.request.body).toEqual({ activo: true });
    request.flush(ADVISOR_DTO);
  });
});
