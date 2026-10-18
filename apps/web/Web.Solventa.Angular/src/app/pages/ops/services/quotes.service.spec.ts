import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { OfertaCotizacionResponse } from '../interfaces/quote-payload.interface';
import { QuotesService, RamoCatalogDto } from './quotes.service';

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

  it('obtains the catalog of cotizable ramos from the BFF Web', () => {
    const mockRamos: readonly RamoCatalogDto[] = [
      { id: 'ramo-viaje', nombre: 'Viaje' },
      { id: 'ramo-vida-hipotecario', nombre: 'Vida hipotecario' },
      { id: 'ramo-microseguro-vida', nombre: 'Microseguro de vida' },
      { id: 'ramo-parametrico', nombre: 'Paramétrico (clima / vuelo)' },
    ];

    let result: readonly RamoCatalogDto[] | undefined;
    service.getRamos().subscribe((ramos) => {
      result = ramos;
    });

    const req = http.expectOne(API_ENDPOINTS.ramos);
    expect(req.request.method).toBe('GET');
    req.flush(mockRamos);

    expect(result).toEqual(mockRamos);
    expect(result?.length).toBe(4);
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
