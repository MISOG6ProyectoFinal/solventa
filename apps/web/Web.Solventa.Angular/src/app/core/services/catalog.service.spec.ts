import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each([
    ['documentTypes$', API_ENDPOINTS.documentTypes, ['CC', 'CE']],
    ['partnerTypes$', API_ENDPOINTS.partnerTypes, ['Banco', 'Fintech']],
    ['partnerScopes$', API_ENDPOINTS.partnerScopes, ['cotizacion', 'emision']],
  ] as const)('reads %s as published by its service', (list, url, values) => {
    let result: readonly string[] | undefined;
    service[list].subscribe((items) => {
      result = items;
    });

    http.expectOne(url).flush(values);

    expect(result).toEqual(values);
  });

  it('keeps only the id of each policy status', () => {
    let result: readonly string[] | undefined;
    service.policyStatuses$.subscribe((statuses) => {
      result = statuses;
    });

    http.expectOne(API_ENDPOINTS.policyStatuses).flush([
      { id: 'activa', nombre: 'Activa' },
      { id: 'cancelada', nombre: 'Cancelada' },
    ]);

    expect(result).toEqual(['activa', 'cancelada']);
  });

  it('reads the cancellation causes with whether they refund the premium', () => {
    let result: unknown;
    service.cancellationCauses$.subscribe((causes) => {
      result = causes;
    });

    http.expectOne(API_ENDPOINTS.cancellationCauses).flush([
      { id: 'retracto', nombre: 'Retracto', reembolsable: true },
      { id: 'impago-de-prima', nombre: 'Impago de prima', reembolsable: false },
    ]);

    expect(result).toEqual([
      { id: 'retracto', name: 'Retracto', refundable: true },
      { id: 'impago-de-prima', name: 'Impago de prima', refundable: false },
    ]);
  });

  it('asks the backend once however many components read a list', () => {
    service.documentTypes$.subscribe();
    service.documentTypes$.subscribe();

    http.expectOne(API_ENDPOINTS.documentTypes).flush(['CC']);
  });
});
