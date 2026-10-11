import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../interfaces/api-response.interface';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;

  const fail = (body: object | null, status: number): ApiError => {
    let failure!: ApiError;
    client.get('/api').subscribe({ error: (error: ApiError) => (failure = error) });
    http.expectOne('/api').flush(body, { status, statusText: 'Error' });
    return failure;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('reads the business code and message of a structured detail', () => {
    const error = fail({ detail: { codigo: 'identificador_duplicado', mensaje: 'Ya existe' } }, 409);

    expect(error).toMatchObject({ status: 409, code: 'identificador_duplicado', message: 'Ya existe' });
  });

  it('reads a plain text detail', () => {
    const error = fail({ detail: 'Servicio interno no disponible' }, 503);

    expect(error.message).toBe('Servicio interno no disponible');
    expect(error.code).toBeUndefined();
  });

  it('falls back to the HTTP message when there is no detail', () => {
    expect(fail(null, 500).message).toContain('500');
  });
});
