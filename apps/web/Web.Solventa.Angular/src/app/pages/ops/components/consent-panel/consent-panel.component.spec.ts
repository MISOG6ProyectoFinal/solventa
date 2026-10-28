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

    expect(validatedSpy).toHaveBeenCalledWith('CNS-51502');
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

  it('displays error message when requesting OTP fails from backend', async () => {
    await render(true);

    el.querySelector('button')!.click();
    await fixture.whenStable();

    httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar).flush(
      { detail: 'Error del servidor al emitir OTP' },
      { status: 500, statusText: 'Internal Server Error' }
    );
    await fixture.whenStable();

    expect(el.textContent).toContain('Error del servidor al emitir OTP');
  });

  it('handles email channel selection and masking', async () => {
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('ramoLabel', 'Vida hipotecario');
    fixture.componentRef.setInput('correo', 'juan.perez@solventa.com');
    await fixture.whenStable();
    el = fixture.nativeElement;

    // Switch to email channel
    fixture.componentInstance['channel'].set('email');
    await fixture.whenStable();

    el.querySelector('button')!.click();
    await fixture.whenStable();

    const req = httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar);
    expect(req.request.body.canal).toBe('email');
    expect(req.request.body.contacto).toBe('juan.perez@solventa.com');
    expect(req.request.body.contacto_mask).toBe('ju***@solventa.com');
    req.flush({
      consentimiento_id: 'CNS-EMAIL-1',
      estado: 'PENDIENTE',
      contacto_mask: 'ju***@solventa.com',
      codigo_demo: '654321',
      expira_en: '2026-09-12T13:05:00Z',
    });
    await fixture.whenStable();

    expect(el.textContent).toContain('Código enviado al correo ju***@solventa.com.');
  });

  it('shows error if validating with empty code', async () => {
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

    // Clear code
    const input = el.querySelector('input[placeholder="123456"]') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.componentInstance['codigoInput'].set('');
    await fixture.whenStable();

    const validateBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Validar código')
    )!;
    validateBtn.click();
    await fixture.whenStable();

    expect(el.textContent).toContain('Ingrese el código dictado por el cliente');
  });

  it('uses fallback registry when consultar fails after validation', async () => {
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

    const validateBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Validar código')
    )!;
    validateBtn.click();
    await fixture.whenStable();

    httpTesting.expectOne(API_ENDPOINTS.consentimientos.validar).flush({
      consentimiento_id: 'CNS-51502',
      estado: 'OTORGADO',
      validado_en: '2026-09-12T13:00:00Z',
    });

    httpTesting.expectOne(API_ENDPOINTS.consentimientos.consultar('CNS-51502')).flush(
      { detail: 'Not found' },
      { status: 404, statusText: 'Not Found' }
    );
    await fixture.whenStable();

    expect(el.textContent).toContain('Consentimiento validado.');
    expect(el.textContent).toContain('CNS-51502');
  });

  it('prevents non-numeric key events in blockNonNumeric', () => {
    const eventDigit = new KeyboardEvent('keydown', { key: '5', cancelable: true });
    const eventAlpha = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    const eventEnter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });

    fixture.componentInstance.blockNonNumeric(eventDigit);
    expect(eventDigit.defaultPrevented).toBe(false);

    fixture.componentInstance.blockNonNumeric(eventAlpha);
    expect(eventAlpha.defaultPrevented).toBe(true);

    fixture.componentInstance.blockNonNumeric(eventEnter);
    expect(eventEnter.defaultPrevented).toBe(false);
  });

  it('triggers reenviar correctly', async () => {
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

    const reenviarBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reenviar')
    )!;
    reenviarBtn.click();
    await fixture.whenStable();

    httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar).flush({
      consentimiento_id: 'CNS-51502-V2',
      estado: 'PENDIENTE',
      contacto_mask: '***4567',
      codigo_demo: '999888',
      expira_en: '2026-09-12T13:10:00Z',
    });
    await fixture.whenStable();

    expect(el.textContent).toContain('999888');
  });

  it('masks correctly when email username has 2 or fewer characters', async () => {
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('ramoLabel', 'Vida hipotecario');
    fixture.componentRef.setInput('correo', 'al@test.com');
    await fixture.whenStable();
    fixture.componentInstance['channel'].set('email');
    await fixture.whenStable();

    expect(fixture.componentInstance['contactoMask']()).toBe('a***@test.com');
  });

  it('handles invalid email and empty email fallbacks in mask', async () => {
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('ramoLabel', 'Vida hipotecario');
    fixture.componentRef.setInput('correo', 'sinarroba');
    await fixture.whenStable();
    fixture.componentInstance['channel'].set('email');
    await fixture.whenStable();

    expect(fixture.componentInstance['contactoMask']()).toBe('sinarroba');

    fixture.componentRef.setInput('correo', '');
    await fixture.whenStable();
    expect(fixture.componentInstance['contactoMask']()).toBe('cliente@ejemplo.com');
  });

  it('handles short phone numbers in sms mask', async () => {
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('ramoLabel', 'Vida hipotecario');
    fixture.componentRef.setInput('celular', '123');
    await fixture.whenStable();

    expect(fixture.componentInstance['contactoMask']()).toBe('123');
  });

  it('builds payload with complete customer info and custom alcances', async () => {
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('ramoLabel', 'Vida hipotecario');
    fixture.componentRef.setInput('celular', '3176663766');
    fixture.componentRef.setInput('documento', '1098700941');
    fixture.componentRef.setInput('tipoDocumento', 'CC');
    fixture.componentRef.setInput('nombre', 'Pedro Perez');
    fixture.componentRef.setInput('fechaNacimiento', '1990-05-15');
    await fixture.whenStable();

    fixture.componentInstance['openFinance'].set(false);
    fixture.componentInstance['openData'].set(false);
    await fixture.whenStable();

    el = fixture.nativeElement;
    el.querySelector('button')!.click();
    await fixture.whenStable();

    const req = httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar);
    expect(req.request.body.cliente_id).toBe('CLI-1098700941');
    expect(req.request.body.nombre).toBe('Pedro Perez');
    expect(req.request.body.fecha_nacimiento).toBe('1990-05-15');
    expect(req.request.body.alcance).toEqual([]);
    req.flush({
      consentimiento_id: 'CNS-FULL',
      estado: 'PENDIENTE',
      codigo_demo: '112233',
      expira_en: '2026-09-12T13:05:00Z',
    });
  });

  it('sends apellido when provided in input', async () => {
    await render(true);
    fixture.componentRef.setInput('nombre', 'Carlos');
    fixture.componentRef.setInput('apellido', 'Gómez');
    await fixture.whenStable();

    el.querySelector('button')!.click();
    await fixture.whenStable();

    const req = httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar);
    expect(req.request.body.nombre).toBe('Carlos');
    expect(req.request.body.apellido).toBe('Gómez');
    req.flush({
      consentimiento_id: 'CNS-APE-1',
      estado: 'PENDIENTE',
      contacto_mask: '***4567',
      codigo_demo: '112233',
      expira_en: '2026-09-12T13:05:00Z',
    });
  });

  it('extracts error messages from error.message property as fallback', async () => {
    await render(true);

    el.querySelector('button')!.click();
    await fixture.whenStable();

    httpTesting.expectOne(API_ENDPOINTS.consentimientos.solicitar).error(
      new ProgressEvent('error'),
      { status: 0, statusText: 'Network Error' }
    );
    await fixture.whenStable();

    expect(el.textContent).toContain('Error al solicitar código OTP');
  });
});
