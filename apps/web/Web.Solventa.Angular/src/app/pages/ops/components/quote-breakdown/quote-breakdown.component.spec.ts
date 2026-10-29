import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OfertaCotizacionResponse } from '../../interfaces/quote-payload.interface';
import { QuoteBreakdownComponent } from './quote-breakdown.component';

describe('QuoteBreakdownComponent', () => {
  let component: QuoteBreakdownComponent;
  let fixture: ComponentFixture<QuoteBreakdownComponent>;

  const mockQuoteSuccess: OfertaCotizacionResponse = {
    id: 'COT-2026-7641',
    producto_id: 'viaje-internacional',
    prima: 338864,
    coberturas: [
      { id: 'c1', nombre: 'Gastos médicos en el exterior' },
      { id: 'c2', nombre: 'Cancelación de viaje' },
    ],
    vigencia_propuesta: { desde: '2026-10-02', hasta: '2026-10-12' },
    version_reglas: '2026.10.0',
    estado: 'VIGENTE',
    vigente_hasta: '2026-10-12T23:59:59',
    degradada: false,
    desglose: {
      prima_basica: 252000,
      recargo_riesgo: 7560,
      coberturas_adicionales: 25200,
      impuestos: 54104,
      total: 338864,
    },
  };

  const mockQuoteDegraded: OfertaCotizacionResponse = {
    ...mockQuoteSuccess,
    id: 'COT-2026-5740',
    degradada: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteBreakdownComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteBreakdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe mostrar mensaje inicial cuando no hay cotización', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Complete el formulario y calcule');
  });

  it('debe mostrar bloqueo cuando el ramo requiere consentimiento y no ha sido validado', () => {
    fixture.componentRef.setInput('requiresConsent', true);
    fixture.componentRef.setInput('consentValidated', false);
    fixture.componentRef.setInput('ramoLabel', 'Vida hipotecario');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(
      'No es posible cotizar Vida hipotecario sin el consentimiento',
    );
  });

  it('debe mostrar spinner y mensaje durante el cálculo en tiempo real', () => {
    fixture.componentRef.setInput('isCalculating', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Calculando prima en tiempo real...');
    expect(compiled.querySelector('.animate-spin')).toBeTruthy();
  });

  it('debe mostrar mensaje de error amigable cuando ocurre un fallo', () => {
    const errorTexto =
      'No fue posible calcular la tarifa en este momento porque un proveedor de información no respondió.';
    fixture.componentRef.setInput('errorMessage', errorTexto);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(errorTexto);
  });

  it('debe mostrar desglose exitoso con todos los rubros, ID y coberturas', () => {
    fixture.componentRef.setInput('quoteResult', mockQuoteSuccess);
    fixture.componentRef.setInput('ramoLabel', 'Viaje');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Cotización generada correctamente.');
    expect(compiled.textContent).toContain('COT-2026-7641');
    expect(compiled.textContent).toContain('VIGENTE');
    expect(compiled.textContent).toContain('Prima básica');
    expect(compiled.textContent).toContain('Recargo de riesgo');
    expect(compiled.textContent).toContain('Coberturas adicionales');
    expect(compiled.textContent).toContain('Impuestos (IVA 19%)');
    expect(compiled.textContent).toContain('Total');
    expect(compiled.textContent).toContain('Gastos médicos en el exterior');
    expect(compiled.textContent).toContain('Cancelación de viaje');
    expect(compiled.textContent).toContain('Ramo: Viaje');
  });

  it('debe mostrar advertencia de modo degradado cuando degradada es true', () => {
    fixture.componentRef.setInput('quoteResult', mockQuoteDegraded);
    fixture.componentRef.setInput('ramoLabel', 'Viaje');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(
      'Calculado en modo degradado con la última información válida disponible',
    );
    expect(compiled.textContent).toContain('COT-2026-5740');
  });
});
