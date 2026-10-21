import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import {
  RespuestaConsultaConsentimiento,
  RespuestaSolicitud,
  RespuestaValidacion,
  SolicitudConsentimiento,
} from '../interfaces/consent.interface';
import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  let service: ConsentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConsentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('solicitar sends POST to request endpoint with request body', () => {
    const solicitud: SolicitudConsentimiento = {
      cliente_id: 'CLI-001',
      ramo: 'VIDA_HIPOTECARIO',
      canal: 'sms',
      contacto_mask: '***4567',
      open_finance: true,
      open_data: true,
      asesor: 'Ana Gómez (asesor)',
    };

    const mockResponse: RespuestaSolicitud = {
      consentimiento_id: 'CNS-51502',
      estado: 'PENDIENTE',
      contacto_mask: '***4567',
      codigo_demo: '123456',
      expira_en: '2026-09-12T13:05:00Z',
    };

    let result: RespuestaSolicitud | undefined;
    service.solicitar(solicitud).subscribe((res) => {
      result = res;
    });

    const req = http.expectOne(API_ENDPOINTS.consentimientos.solicitar);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(solicitud);
    req.flush(mockResponse);

    expect(result).toEqual(mockResponse);
  });

  it('validar sends POST to validation endpoint with ID and OTP code', () => {
    const mockResponse: RespuestaValidacion = {
      consentimiento_id: 'CNS-51502',
      estado: 'OTORGADO',
      validado_en: '2026-09-12T13:02:00Z',
      asesor: 'Ana Gómez (asesor)',
      canal: 'sms',
      open_finance: true,
      open_data: true,
    };

    let result: RespuestaValidacion | undefined;
    service.validar('CNS-51502', '123456').subscribe((res) => {
      result = res;
    });

    const req = http.expectOne(API_ENDPOINTS.consentimientos.validar);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ consentimiento_id: 'CNS-51502', codigo: '123456' });
    req.flush(mockResponse);

    expect(result).toEqual(mockResponse);
  });

  it('consultar sends GET to consultation endpoint', () => {
    const mockResponse: RespuestaConsultaConsentimiento = {
      consentimiento_id: 'CNS-51502',
      estado: 'Otorgado',
      fecha_hora: '2026-09-12 13:00',
      asesor: 'Ana Gómez (asesor)',
      canal: 'Código por SMS',
      alcance: 'Open Finance, Open Data',
    };

    let result: RespuestaConsultaConsentimiento | undefined;
    service.consultar('CNS-51502').subscribe((res) => {
      result = res;
    });

    const req = http.expectOne(API_ENDPOINTS.consentimientos.consultar('CNS-51502'));
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(result).toEqual(mockResponse);
  });
});
