import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { Ramo } from '../../../core/models/ramo.model';
import { OfertaCotizacionResponse } from '../interfaces/quote-payload.interface';
import { RAMOS_DTO } from '../../../core/testing/ramos.fixtures';
import { QuotesService } from './quotes.service';

describe('QuotesService', () => {
  let service: QuotesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(QuotesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the ramos of the web channel with their products and the consent they require', () => {
    let result: readonly Ramo[] | undefined;
    service.getRamos().subscribe((ramos) => {
      result = ramos;
    });

    const req = http.expectOne(API_ENDPOINTS.ramos);
    expect(req.request.method).toBe('GET');
    req.flush(RAMOS_DTO);

    expect(result?.map((ramo) => ramo.id)).toEqual([
      'ramo-viaje',
      'ramo-microseguro-vida',
      'ramo-parametrico',
      'ramo-vida-hipotecario',
    ]);
    expect(result?.[3]).toEqual({
      id: 'ramo-vida-hipotecario',
      name: 'Vida hipotecario',
      requiresConsent: true,
      products: [{ id: 'vida-hipotecario', name: 'Vida Hipotecario', requiresConsent: true }],
    });
    expect(result?.[0].requiresConsent).toBe(false);
  });

  it('reads the contract of a product', () => {
    let result: unknown;
    service.getContract('viaje-internacional').subscribe((contract) => {
      result = contract;
    });

    const req = http.expectOne(API_ENDPOINTS.productContract('viaje-internacional'));
    expect(req.request.method).toBe('GET');
    req.flush({ properties: { destino: { enum: ['España'] } } });

    expect(result).toEqual({ properties: { destino: { enum: ['España'] } } });
  });

  it('posts quote request payload to the consensus endpoint and returns the offer', () => {
    const payload = {
      producto_id: 'viaje-internacional',
      destino: 'España',
      fecha_salida: '2026-10-20',
      fecha_regreso: '2026-10-30',
      viajeros: 2,
    };

    const mockResponse: OfertaCotizacionResponse = {
      id: 'quote-456',
      producto_id: 'viaje-internacional',
      prima: 214200,
      coberturas: [{ id: 'asistencia-medica', nombre: 'Asistencia médica en viaje' }],
      vigencia_propuesta: { desde: '2026-10-20', hasta: '2026-10-30' },
      version_reglas: '2026.10.0',
    };

    let result: OfertaCotizacionResponse | undefined;
    service.cotizar(payload).subscribe((response) => {
      result = response;
    });

    const req = http.expectOne(API_ENDPOINTS.quotes);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);

    expect(result).toEqual(mockResponse);
    expect(result?.prima).toBe(214200);
  });
});
