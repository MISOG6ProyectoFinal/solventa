import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { API_ENDPOINTS } from '../../../../core/constants/api-endpoints.constants';
import { QuoteTabComponent, quoteErrorMessage } from './quote-tab.component';

describe('QuoteTabComponent', () => {
  let fixture: ComponentFixture<QuoteTabComponent>;
  let el: HTMLElement;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [QuoteTabComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(QuoteTabComponent);
    await fixture.whenStable();

    httpTesting
      .expectOne({ method: 'GET', url: API_ENDPOINTS.simulator('open-finance') })
      .flush({ proveedor: 'open-finance', modo: 'normal' });
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('composes the form, the consent panel, the simulation and the breakdown', () => {
    expect(el.querySelector('slv-quote-form')).not.toBeNull();
    expect(el.querySelector('slv-consent-panel')).not.toBeNull();
    expect(el.textContent).toContain('Simulación de Open Finance (demo)');
    expect(el.textContent).toContain('Desglose de cotización');
  });

  it('starts on Vida hipotecario, which requires consent', () => {
    expect(el.textContent).toContain(
      'Debe solicitar y validar el consentimiento antes de cotizar.',
    );
  });

  it('drops the consent requirement when a ramo without consent is selected', async () => {
    const ramoSelect = el.querySelector<HTMLSelectElement>('slv-quote-form select')!;

    ramoSelect.value = 'VIAJE';
    ramoSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(el.textContent).not.toContain(
      'Debe solicitar y validar el consentimiento antes de cotizar.',
    );
    expect(el.textContent).toContain('no requiere consentimiento');
  });

  it('renders the calculated quote breakdown when calculation succeeds', async () => {
    const comp = fixture.componentInstance;
    (comp as any).onQuoteReady({
      tipoDocumento: 'CC',
      numeroDocumento: '1020304050',
      nombre: 'Juan Pérez',
      email: 'juan@email.com',
      telefono: '3001234567',
      fechaNacimiento: '1985-05-15',
      entidad: 'Banco Aurora',
      valorCredito: '200000000',
      plazoAnios: '20',
    });

    const req = httpTesting.expectOne(API_ENDPOINTS.quotes);
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'quote-123',
      producto_id: 'vida-hipotecario',
      prima: 3200000,
      coberturas: [
        { id: 'hipotecario-fallecimiento', nombre: 'Fallecimiento (saldo del crédito)' },
        { id: 'hipotecario-incapacidad', nombre: 'Incapacidad total' },
      ],
      vigencia_propuesta: { desde: '2026-10-12', hasta: '2046-10-12' },
      version_reglas: '2026.10.0',
    });

    await fixture.whenStable();

    expect(el.textContent).toContain('Cotización generada correctamente.');
    expect(el.textContent).toContain('quote-123');
    expect(el.textContent).toContain('Fallecimiento (saldo del crédito)');
    expect(el.textContent).toContain('Incapacidad total');
  });

  it('renders error message when calculation fails', async () => {
    const comp = fixture.componentInstance;
    (comp as any).onQuoteReady({
      valorCredito: '200000000',
    });

    const req = httpTesting.expectOne(API_ENDPOINTS.quotes);
    req.flush(
      { detail: 'Producto sin tarifa' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    await fixture.whenStable();

    expect(el.textContent).toContain('Producto sin tarifa');
  });

  it('renders the unified error with the fields to fix', async () => {
    const comp = fixture.componentInstance;
    (comp as any).onQuoteReady({
      valorCredito: '200000000',
    });

    const req = httpTesting.expectOne(API_ENDPOINTS.quotes);
    req.flush(
      {
        detail: {
          codigo: 'datos_invalidos',
          mensaje: 'La solicitud tiene datos faltantes o inválidos. No se calculó la prima.',
          campos: [{ campo: 'entidad', error: 'Campo obligatorio' }],
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    await fixture.whenStable();

    expect(el.textContent).toContain('No se calculó la prima. entidad: Campo obligatorio');
  });

  it('renders amber degraded banner when response is degradada', async () => {
    const comp = fixture.componentInstance;
    (comp as unknown as { onQuoteReady: (v: Record<string, string>) => void }).onQuoteReady({
      valorCredito: '200000000',
    });

    const req = httpTesting.expectOne(API_ENDPOINTS.quotes);
    req.flush({
      id: 'COT-2026-DEG1',
      producto_id: 'vida-hipotecario',
      prima: 350000,
      coberturas: [],
      vigencia_propuesta: { desde: '2026-10-12', hasta: '2046-10-12' },
      version_reglas: '2026.10.0',
      degradada: true,
    });

    await fixture.whenStable();
    expect(el.textContent).toContain('Calculado en modo degradado con la última información válida disponible');
  });

  it('renders default error message when calculation error has no detail', async () => {
    const comp = fixture.componentInstance;
    (comp as any).onQuoteReady({
      valorCredito: '200000000',
    });

    const req = httpTesting.expectOne(API_ENDPOINTS.quotes);
    req.flush(null, { status: 500, statusText: 'Server Error' });

    await fixture.whenStable();

    expect(el.textContent).toContain('Error al calcular cotización');
  });

  it('blocks quote calculation and shows alert when consent is required but not validated', async () => {
    // Starts on VIDA_HIPOTECARIO
    await fixture.whenStable();

    const calcBtn =
      el.querySelector<HTMLButtonElement>('button[type="button"]:not([variant])') ||
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Calcular cotización'),
      )!;

    expect(calcBtn.disabled).toBe(true);
    expect(el.textContent).toContain(
      'No es posible cotizar Vida hipotecario sin el consentimiento Open Finance / Open Data validado del cliente.',
    );
  });

  it('unblocks quote calculation when consent is validated', async () => {
    const comp = fixture.componentInstance;
    (comp as any).consentValidated.set(true);
    await fixture.whenStable();

    const calcBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Calcular cotización'),
    )!;

    expect(calcBtn.disabled).toBe(false);
    expect(el.textContent).not.toContain(
      'No es posible cotizar Vida hipotecario sin el consentimiento Open Finance / Open Data validado del cliente.',
    );
  });

  it('changes the Open Finance simulator when another scenario is chosen', async () => {
    const select = Array.from(el.querySelectorAll('select')).find((item) =>
      Array.from(item.options).some((option) => option.value === 'caida'),
    )!;
    select.value = 'caida';
    select.dispatchEvent(new Event('change'));

    const req = httpTesting.expectOne({ method: 'PUT', url: `${API_ENDPOINTS.simulator('open-finance')}/modo` });
    expect(req.request.body).toEqual({ modo: 'caido' });
    req.flush({ proveedor: 'open-finance', modo: 'caido' });
    await fixture.whenStable();

    expect(el.textContent).not.toContain('No fue posible cambiar el simulador de Open Finance.');
  });

  it('tells the advisor when the simulator cannot be changed', async () => {
    const select = Array.from(el.querySelectorAll('select')).find((item) =>
      Array.from(item.options).some((option) => option.value === 'degradado'),
    )!;
    select.value = 'degradado';
    select.dispatchEvent(new Event('change'));

    const req = httpTesting.expectOne(`${API_ENDPOINTS.simulator('open-finance')}/modo`);
    expect(req.request.body).toEqual({ modo: 'lento' });
    req.flush(null, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    expect(el.textContent).toContain('No fue posible cambiar el simulador de Open Finance.');
  });
});

describe('quoteErrorMessage', () => {
  const FALLBACK = 'Error al calcular cotización';

  it('keeps a plain message', () => {
    expect(quoteErrorMessage('Producto sin tarifa', FALLBACK)).toBe('Producto sin tarifa');
  });

  it('shows the message of a product error', () => {
    expect(
      quoteErrorMessage({ codigo: 'producto_inactivo', mensaje: 'Producto inactivo: hogar' }, FALLBACK),
    ).toBe('Producto inactivo: hogar');
  });

  it('falls back when the detail has nothing to show', () => {
    expect(quoteErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(quoteErrorMessage('', FALLBACK)).toBe(FALLBACK);
    expect(quoteErrorMessage([{ msg: 'Field required' }], FALLBACK)).toBe(FALLBACK);
    expect(quoteErrorMessage({ codigo: 'x' }, FALLBACK)).toBe(FALLBACK);
  });
});
