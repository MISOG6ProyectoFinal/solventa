import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { API_ENDPOINTS } from '../../../../core/constants/api-endpoints.constants';
import { QuoteTabComponent } from './quote-tab.component';

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

    const ramosReq = httpTesting.match(API_ENDPOINTS.ramos);
    for (const req of ramosReq) {
      req.flush([
        { id: 'ramo-viaje', nombre: 'Viaje' },
        { id: 'ramo-vida-hipotecario', nombre: 'Vida hipotecario' },
        { id: 'ramo-microseguro-vida', nombre: 'Microseguro de vida' },
        { id: 'ramo-parametrico', nombre: 'Paramétrico (clima / vuelo)' },
      ]);
    }
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
    expect(el.textContent).toContain('Simulación de proveedores externos (demo)');
    expect(el.textContent).toContain('Desglose de cotización');
  });

  it('starts on Vida hipotecario, which requires consent', () => {
    expect(el.textContent).toContain('Debe solicitar y validar el consentimiento antes de cotizar.');
  });

  it('drops the consent requirement when a ramo without consent is selected', async () => {
    const ramoSelect = el.querySelector<HTMLSelectElement>('slv-quote-form select')!;

    ramoSelect.value = 'VIAJE';
    ramoSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(el.textContent).not.toContain('Debe solicitar y validar el consentimiento antes de cotizar.');
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

    expect(el.textContent).toContain('Prima Calculada');
    expect(el.textContent).toContain('2026.10.0');
    expect(el.textContent).toContain('Fallecimiento (saldo del crédito)');
    expect(el.textContent).toContain('Incapacidad total');
  });

  it('renders error message when calculation fails', async () => {
    const comp = fixture.componentInstance;
    (comp as any).onQuoteReady({
      valorCredito: '200000000',
    });

    const req = httpTesting.expectOne(API_ENDPOINTS.quotes);
    req.flush({ detail: 'Producto sin tarifa' }, { status: 422, statusText: 'Unprocessable Entity' });

    await fixture.whenStable();

    expect(el.textContent).toContain('Producto sin tarifa');
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

    const calcBtn = el.querySelector<HTMLButtonElement>('button[type="button"]:not([variant])') ||
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Calcular cotización'))!;

    expect(calcBtn.disabled).toBe(true);
    expect(el.textContent).toContain(
      'No es posible cotizar Vida hipotecario sin el consentimiento Open Finance / Open Data validado del cliente.'
    );
  });

  it('unblocks quote calculation when consent is validated', async () => {
    const comp = fixture.componentInstance;
    (comp as any).consentValidated.set(true);
    await fixture.whenStable();

    const calcBtn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Calcular cotización'))!;

    expect(calcBtn.disabled).toBe(false);
    expect(el.textContent).not.toContain(
      'No es posible cotizar Vida hipotecario sin el consentimiento Open Finance / Open Data validado del cliente.'
    );
  });
});
