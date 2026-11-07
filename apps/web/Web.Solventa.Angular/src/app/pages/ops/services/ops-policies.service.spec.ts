import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { OPS_POLICIES } from '../testing/ops-policies.fixture';
import { OpsPoliciesService } from './ops-policies.service';

describe('OpsPoliciesService', () => {
  let service: OpsPoliciesService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(OpsPoliciesService);
    http.expectOne(API_ENDPOINTS.webPolicies).flush(OPS_POLICIES);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('loads every policy from the BFF on start and lists the distinct partners', () => {
    expect(service.policies().length).toBe(OPS_POLICIES.length);
    expect(service.partners()).toContain('Banco Aurora');
    expect(new Set(service.partners()).size).toBe(service.partners().length);
  });

  it('searches in the backend after the debounce, sending the text as q', () => {
    service.search('1020304050');
    vi.advanceTimersByTime(300);

    const request = http.expectOne((req) => req.url === API_ENDPOINTS.webPolicies);
    expect(request.request.params.get('q')).toBe('1020304050');
    request.flush([OPS_POLICIES[0]]);
    expect(service.policies().length).toBe(1);
  });

  it('flags a load error and keeps the previous list when the backend fails', () => {
    service.search('x');
    vi.advanceTimersByTime(300);
    http.expectOne((req) => req.url === API_ENDPOINTS.webPolicies).flush('error', { status: 503, statusText: 'x' });

    expect(service.loadError()).toBe(true);
    expect(service.policies().length).toBe(OPS_POLICIES.length);
  });

  it('opens a policy showing the list data first and then the detail from the backend', () => {
    service.open('p1');
    expect(service.selected()?.number).toBe('SLV-2024-00391');

    http.expectOne(`${API_ENDPOINTS.webPolicies}/p1`).flush({ ...OPS_POLICIES[0], insuredName: 'Detalle' });
    expect(service.selected()?.insuredName).toBe('Detalle');

    service.close();
    expect(service.selected()).toBeNull();
  });

  it('flags an error when the detail cannot be loaded', () => {
    service.open('missing');
    expect(service.selected()).toBeNull();

    http.expectOne(`${API_ENDPOINTS.webPolicies}/missing`).flush('error', { status: 404, statusText: 'x' });
    expect(service.loadError()).toBe(true);
  });

  it('cancels a policy keeping the reason and date', () => {
    service.open('p1');
    http.expectOne(`${API_ENDPOINTS.webPolicies}/p1`).flush(OPS_POLICIES[0]);

    service.cancel('p1', 'Retracto');

    expect(service.selected()?.status).toBe('Cancelada');
    const policy = service.policies().find((item) => item.id === 'p1')!;
    expect(policy.cancelReason).toBe('Retracto');
    expect(policy.cancelDate).toBeTruthy();
  });
});
