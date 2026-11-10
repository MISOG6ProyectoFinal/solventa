import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { POLICY_DTO } from '../testing/policy.fixtures';
import { OpsPoliciesService } from './ops-policies.service';

const PARTNER_POLICY = { ...POLICY_DTO, id: 'pol-2', canal: 'socios', cliente: null, socio: { id: 's-1', nombre: 'Banco Aurora' } };

describe('OpsPoliciesService', () => {
  let service: OpsPoliciesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    service = TestBed.inject(OpsPoliciesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the recent policies from the BFF', () => {
    service.load();
    expect(service.loading()).toBe(true);

    http.expectOne({ method: 'GET', url: API_ENDPOINTS.policies }).flush([POLICY_DTO, PARTNER_POLICY]);

    expect(service.loading()).toBe(false);
    expect(service.policies().map((policy) => policy.number)).toEqual(['POL-ABC123', 'POL-ABC123']);
    expect(service.partners()).toEqual(['mobile', 'Banco Aurora']);
  });

  it('keeps the error when the policies cannot be loaded', () => {
    service.load();

    http
      .expectOne(API_ENDPOINTS.policies)
      .flush({ detail: 'Servicio interno no disponible' }, { status: 503, statusText: 'Unavailable' });

    expect(service.loadError()).toBe('Servicio interno no disponible');
    expect(service.policies()).toEqual([]);
  });

  it('opens a policy with the summary first and then its detail', () => {
    service.load();
    http.expectOne(API_ENDPOINTS.policies).flush([{ ...POLICY_DTO, pagos: undefined, siniestros: undefined }]);

    service.open('pol-1');
    expect(service.selected()?.payments).toEqual([]);
    expect(service.detailLoading()).toBe(true);

    http.expectOne(API_ENDPOINTS.policy('pol-1')).flush(POLICY_DTO);

    expect(service.detailLoading()).toBe(false);
    expect(service.selected()?.payments.map((payment) => payment.status)).toEqual(['aprobado']);
    expect(service.selected()?.claims.map((claim) => claim.id)).toEqual(['SIN-1001']);
  });

  it('closing the detail clears the selection', () => {
    service.open(null);

    expect(service.selected()).toBeNull();
  });

  it('cancels a policy in this view keeping the reason and date', () => {
    service.load();
    http.expectOne(API_ENDPOINTS.policies).flush([POLICY_DTO]);
    service.open('pol-1');
    http.expectOne(API_ENDPOINTS.policy('pol-1')).flush(POLICY_DTO);

    service.cancel('pol-1', 'retracto');

    expect(service.selected()?.status).toBe('cancelada');
    expect(service.selected()?.cancelReason).toBe('retracto');
    expect(service.policies()[0].cancelDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps the summary when the detail fails', () => {
    service.load();
    http.expectOne(API_ENDPOINTS.policies).flush([POLICY_DTO]);
    service.open('pol-1');

    http.expectOne(API_ENDPOINTS.policy('pol-1')).flush(null, { status: 503, statusText: 'Unavailable' });

    expect(service.detailLoading()).toBe(false);
    expect(service.selected()?.number).toBe('POL-ABC123');
  });

  it('registers an endorsement and reloads the policy detail', () => {
    const draft = { effectiveDate: '2026-12-01', name: 'Lina D.', phone: '300', email: 'l@x.co', address: 'Calle 1', reason: 'Mudanza' };

    service.registerEndorsement('pol-1', draft).subscribe();

    const post = http.expectOne({ method: 'POST', url: API_ENDPOINTS.policyEndorsements('pol-1') });
    expect(post.request.body).toEqual({
      fecha_efectiva: '2026-12-01',
      motivo: 'Mudanza',
      version_nueva: { nombre: 'Lina D.', telefono: '300', correo: 'l@x.co', direccion: 'Calle 1' },
    });
    post.flush({ id: 'end-1' });
    http.expectOne({ method: 'GET', url: API_ENDPOINTS.policy('pol-1') }).flush(POLICY_DTO);
  });
});
