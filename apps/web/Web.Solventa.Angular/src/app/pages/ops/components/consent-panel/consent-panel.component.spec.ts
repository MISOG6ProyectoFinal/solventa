import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { API_ENDPOINTS } from '../../../../core/constants/api-endpoints.constants';
import { ConsentPanelComponent } from './consent-panel.component';

describe('ConsentPanelComponent', () => {
  let fixture: ComponentFixture<ConsentPanelComponent>;
  let el: HTMLElement;
  let httpTesting: HttpTestingController;

  const render = async (required: boolean, celular = '3001234567'): Promise<void> => {
    fixture.componentRef.setInput('required', required);
    fixture.componentRef.setInput('ramoLabel', 'Vida hipotecario');
    fixture.componentRef.setInput('ramoId', 'VIDA_HIPOTECARIO');
    fixture.componentRef.setInput('celular', celular);
    await fixture.whenStable();
    el = fixture.nativeElement;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ConsentPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConsentPanelComponent);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('asks for the consent when the ramo requires it', async () => {
    await render(true);

    expect(el.textContent).toContain('Debe solicitar y validar el consentimiento antes de cotizar.');
    expect(el.querySelector('button')!.textContent).toContain('Solicitar consentimiento');
    expect(el.querySelectorAll('input[type="checkbox"]').length).toBe(2);
  });

  it('shows an informative message when the ramo does not require consent', async () => {
    fixture.componentRef.setInput('required', false);
    fixture.componentRef.setInput('ramoLabel', 'Viaje');
    await fixture.whenStable();
    el = fixture.nativeElement;

    expect(el.textContent).toContain('El ramo Viaje no requiere consentimiento');
    expect(el.querySelector('button')).toBeNull();
  });

  it('emits when the consent request button is pressed', async () => {
    await render(true);
    const emitted = vi.fn();
    fixture.componentInstance.requested.subscribe(emitted);

    el.querySelector('button')!.click();
    await fixture.whenStable();

    const req = httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar);
    req.flush({
      consentimiento_id: 'CNS-51502',
      estado: 'PENDIENTE',
      contacto_mask: '***4567',
      codigo_demo: '123456',
      expira_en: '2026-09-12T13:05:00Z',
    });

    expect(emitted).toHaveBeenCalledOnce();
  });

  it('transitions to pending state and displays demo hint on successful request', async () => {
    await render(true);

    el.querySelector('button')!.click();
    await fixture.whenStable();

    const req = httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar);
    req.flush({
      consentimiento_id: 'CNS-51502',
      estado: 'PENDIENTE',
      contacto_mask: '***4567',
      codigo_demo: '482910',
      expira_en: '2026-09-12T13:05:00Z',
    });
    await fixture.whenStable();

    expect(el.textContent).toContain('Código enviado al celular ***4567. Para la demo use 482910.');
    expect(el.querySelector('input[placeholder="123456"]')).not.toBeNull();
    expect(el.textContent).toContain('Validar código');
    expect(el.textContent).toContain('Reenviar');
  });

  it('validates OTP successfully and displays the consent registry info', async () => {
    await render(true);

    // 1. Request OTP
    el.querySelector('button')!.click();
    await fixture.whenStable();

    httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar).flush({
      consentimiento_id: 'CNS-51502',
      estado: 'PENDIENTE',
      contacto_mask: '***4567',
      codigo_demo: '123456',
      expira_en: '2026-09-12T13:05:00Z',
    });
    await fixture.whenStable();

    const validatedSpy = vi.fn();
    fixture.componentInstance.consentValidated.subscribe(validatedSpy);

    // 2. Click "Validar código"
    const buttons = el.querySelectorAll('button');
    const validateBtn = Array.from(buttons).find((b) => b.textContent?.includes('Validar código'))!;
    validateBtn.click();
    await fixture.whenStable();

    const valReq = httpTesting.expectOne(API_ENDPOINTS.consentimientos.validar);
    expect(valReq.request.body).toEqual({ consentimiento_id: 'CNS-51502', codigo: '123456' });
    valReq.flush({
      consentimiento_id: 'CNS-51502',
      estado: 'OTORGADO',
      validado_en: '2026-09-12T13:00:00Z',
      asesor: 'Ana Gómez (asesor)',
      canal: 'sms',
      open_finance: true,
      open_data: true,
    });

    const getReq = httpTesting.expectOne(API_ENDPOINTS.consentimientos.consultar('CNS-51502'));
    getReq.flush({
      consentimiento_id: 'CNS-51502',
      estado: 'Otorgado',
      fecha_hora: '2026-09-12 13:00',
      asesor: 'Ana Gómez (asesor)',
      canal: 'Código por SMS',
      alcance: 'Open Finance, Open Data',
    });
    await fixture.whenStable();

    expect(validatedSpy).toHaveBeenCalledWith(true);
    expect(el.textContent).toContain('Consentimiento validado. Puede continuar con la cotización.');
    expect(el.textContent).toContain('CNS-51502');
    expect(el.textContent).toContain('Otorgado');
    expect(el.textContent).toContain('Ana Gómez (asesor)');
    expect(el.textContent).toContain('Código por SMS');
    expect(el.textContent).toContain('Open Finance, Open Data');
  });

  it('masks dynamically the client phone number when provided', async () => {
    await render(true, '3176663766');

    el.querySelector('button')!.click();
    await fixture.whenStable();

    const req = httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar);
    expect(req.request.body.contacto).toBe('3176663766');
    expect(req.request.body.contacto_mask).toBe('***3766');
    req.flush({
      consentimiento_id: 'CNS-51502',
      estado: 'PENDIENTE',
      contacto: '3176663766',
      contacto_mask: '***3766',
      codigo_demo: '123456',
      expira_en: '2026-09-12T13:05:00Z',
    });
    await fixture.whenStable();

    expect(el.textContent).toContain('Código enviado al celular ***3766.');
  });

  it('shows error if requesting SMS without phone number', async () => {
    await render(true, '');
    el.querySelector('button')!.click();
    await fixture.whenStable();

    httpTesting.expectNone(API_ENDPOINTS.consentimientos.solicitar);
    expect(el.textContent).toContain('Por favor ingrese el celular del cliente en el formulario antes de solicitar el código.');
  });

  it('displays error message when validation fails', async () => {
    await render(true);

    el.querySelector('button')!.click();
    await fixture.whenStable();

    httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar).flush({
      consentimiento_id: 'CNS-51502',
      estado: 'PENDIENTE',
      contacto_mask: '***4567',
      codigo_demo: '123456',
      expira_en: '2026-09-12T13:05:00Z',
    });
    await fixture.whenStable();

    const buttons = el.querySelectorAll('button');
    const validateBtn = Array.from(buttons).find((b) => b.textContent?.includes('Validar código'))!;
    validateBtn.click();
    await fixture.whenStable();

    httpTesting.expectOne(API_ENDPOINTS.consentimientos.validar).flush(
      { detail: 'Código OTP incorrecto. Vuelva a intentarlo.' },
      { status: 422, statusText: 'Unprocessable Entity' }
    );
    await fixture.whenStable();

    expect(el.textContent).toContain('Código OTP incorrecto. Vuelva a intentarlo.');
  });
});
