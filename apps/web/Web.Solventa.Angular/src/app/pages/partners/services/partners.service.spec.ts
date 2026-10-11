import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { NewPartner, PartnerCreated } from '../../../core/models/partner.model';
import { PARTNER_CONFIG_DTO, PARTNER_CREATED_DTO, PARTNER_DTO } from '../testing/partner.fixtures';
import { toPartnerConfig } from './partners-api.mapper';
import { PartnersService } from './partners.service';

const NEW_PARTNER: NewPartner = {
  name: 'Fintech Demo',
  identifier: 'FINTECH-DEMO',
  tipo: 'Fintech',
  pais: 'Colombia',
  contactEmail: 'ops@fintech.demo',
  alcances: ['cotizacion', 'emision', 'consulta'],
};

describe('PartnersService', () => {
  let service: PartnersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    service = TestBed.inject(PartnersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the provisioned partners from the BFF', () => {
    service.load();
    expect(service.loading()).toBe(true);

    http.expectOne({ method: 'GET', url: API_ENDPOINTS.partners }).flush([PARTNER_DTO]);

    expect(service.loading()).toBe(false);
    expect(service.partners().map((p) => p.identifier)).toEqual(['FINTECH-DEMO']);
    expect(service.findById('s-1')?.name).toBe('Fintech Demo');
    expect(service.findById('missing')).toBeNull();
    expect(service.findById(null)).toBeNull();
  });

  it('exposes the error when the partners cannot be loaded', () => {
    service.load();

    http.expectOne(API_ENDPOINTS.partners).flush({ detail: 'Servicio interno no disponible' }, { status: 503, statusText: 'Unavailable' });

    expect(service.loadError()).toBe('Servicio interno no disponible');
    expect(service.loading()).toBe(false);
    expect(service.partners()).toEqual([]);
  });

  it('creates the partner in the backend and returns the secret once', () => {
    let result: PartnerCreated | undefined;
    service.create(NEW_PARTNER).subscribe((created) => (result = created));

    const request = http.expectOne({ method: 'POST', url: API_ENDPOINTS.partners });
    expect(request.request.body).toEqual({
      nombre: 'Fintech Demo',
      identificador: 'FINTECH-DEMO',
      tipo: 'Fintech',
      pais: 'Colombia',
      correo_contacto: 'ops@fintech.demo',
      alcances: ['cotizacion', 'emision', 'consulta'],
      autorizado_por: 'Ana Gómez',
    });
    request.flush(PARTNER_CREATED_DTO);

    expect(result?.secret).toBe('sv_sec_wp3wshvykwi');
    expect(result?.partner.clientId).toBe('sv_live_fintechdemo_ab12');
    expect(service.partners()[0].secret).toBe('sv_sec_••••••••ykwi');
  });

  it('reports a duplicated identifier without adding the partner', () => {
    let failure: ApiError | undefined;
    service.create(NEW_PARTNER).subscribe({ error: (error: ApiError) => (failure = error) });

    http.expectOne(API_ENDPOINTS.partners).flush(
      { detail: { codigo: 'identificador_duplicado', mensaje: 'Ya existe un socio con este identificador. No es posible crearlo de nuevo.' } },
      { status: 409, statusText: 'Conflict' },
    );

    expect(failure).toMatchObject({
      status: 409,
      code: 'identificador_duplicado',
      message: 'Ya existe un socio con este identificador. No es posible crearlo de nuevo.',
    });
    expect(service.partners()).toEqual([]);
  });

  it('loads the configuration of a partner', () => {
    let enabled: string[] = [];
    service.loadConfig('s-1').subscribe((config) => (enabled = config.ramos.filter((r) => r.enabled).map((r) => r.id)));

    http.expectOne({ method: 'GET', url: API_ENDPOINTS.partnerConfig('s-1') }).flush(PARTNER_CONFIG_DTO);

    expect(enabled).toEqual(['ramo-proteccion-pagos']);
  });

  it('saves the configuration and refreshes the enabled lines of the partner', () => {
    service.load();
    http.expectOne(API_ENDPOINTS.partners).flush([PARTNER_DTO]);

    service.saveConfig('s-1', toPartnerConfig(PARTNER_CONFIG_DTO)).subscribe();

    const request = http.expectOne({ method: 'PUT', url: API_ENDPOINTS.partnerConfig('s-1') });
    expect(request.request.body).toEqual({
      ramos: [{ ramo_id: 'ramo-proteccion-pagos', coberturas: ['pagos-desempleo'] }],
      actualizado_por: 'Ana Gómez',
    });
    request.flush(PARTNER_CONFIG_DTO);

    expect(service.findById('s-1')?.enabledRamos).toEqual([{ id: 'ramo-proteccion-pagos', name: 'Protección de pagos' }]);
  });

  it('keeps the enabled lines when the configuration cannot be saved', () => {
    service.load();
    http.expectOne(API_ENDPOINTS.partners).flush([PARTNER_DTO]);
    let failed = false;

    service.saveConfig('s-1', toPartnerConfig(PARTNER_CONFIG_DTO)).subscribe({ error: () => (failed = true) });
    http.expectOne(API_ENDPOINTS.partnerConfig('s-1')).flush({ detail: 'Servicio interno no disponible' }, { status: 503, statusText: 'Unavailable' });

    expect(failed).toBe(true);
    expect(service.findById('s-1')?.enabledRamos).toEqual([]);
  });
});
