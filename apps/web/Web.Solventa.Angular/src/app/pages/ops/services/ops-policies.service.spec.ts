import { TestBed } from '@angular/core/testing';
import { OpsPoliciesService } from './ops-policies.service';

describe('OpsPoliciesService', () => {
  let service: OpsPoliciesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OpsPoliciesService);
  });

  it('finds a policy by id and returns null when it does not exist', () => {
    expect(service.findById('p1')?.number).toBe('SLV-2024-00391');
    expect(service.findById('missing')).toBeNull();
    expect(service.findById(null)).toBeNull();
  });

  it('lists the distinct partners of origin', () => {
    expect(service.partners()).toContain('Banco Aurora');
    expect(new Set(service.partners()).size).toBe(service.partners().length);
  });

  it('cancels a policy keeping the reason and date', () => {
    service.cancel('p1', 'Retracto');

    const policy = service.findById('p1')!;
    expect(policy.status).toBe('Cancelada');
    expect(policy.cancelReason).toBe('Retracto');
    expect(policy.cancelDate).toBeTruthy();
  });
});
