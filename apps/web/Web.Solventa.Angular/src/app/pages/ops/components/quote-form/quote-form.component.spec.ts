import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Ramo } from '../../../../core/models/ramo.model';
import { CONTRACTS, RAMOS_DTO } from '../../../../core/testing/ramos.fixtures';
import { QuoteFormComponent } from './quote-form.component';

const RAMOS: readonly Ramo[] = RAMOS_DTO.map((ramo) => ({
  id: ramo.id,
  name: ramo.nombre,
  requiresConsent: ramo.requiere_consentimiento,
  products: ramo.productos.map((product) => ({
    id: product.id,
    name: product.nombre,
    requiresConsent: product.requiere_consentimiento,
  })),
}));

describe('QuoteFormComponent', () => {
  let fixture: ComponentFixture<QuoteFormComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [QuoteFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(QuoteFormComponent);
    fixture.componentRef.setInput('ramos', RAMOS);
    fixture.componentRef.setInput('ramo', 'ramo-vida-hipotecario');
    fixture.componentRef.setInput('documentTypes', ['CC', 'CE', 'Pasaporte']);
    fixture.componentRef.setInput('contract', CONTRACTS['vida-hipotecario']);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('lists the ramos the catalog gives it and flags the ones that require consent', () => {
    const options = Array.from(el.querySelectorAll('select')[0].querySelectorAll('option'));

    expect(options.length).toBe(4);
    expect(options.map((option) => option.textContent)).toContain('Vida hipotecario (requiere consentimiento)');
    expect(options.map((option) => option.value)).toEqual([
      'ramo-viaje',
      'ramo-microseguro-vida',
      'ramo-parametrico',
      'ramo-vida-hipotecario',
    ]);
  });

  it('offers the document types the identity service publishes and preselects the first', () => {
    const select = el.querySelectorAll('slv-quote-field select')[0] as HTMLSelectElement;

    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'CC', 'CE', 'Pasaporte']);
    expect((fixture.componentInstance as any).valueOf('tipoDocumento')).toBe('CC');
  });

  it('offers the options its contract declares for a field', async () => {
    fixture.componentRef.setInput('ramo', 'ramo-viaje');
    fixture.componentRef.setInput('contract', CONTRACTS['viaje-internacional']);
    await fixture.whenStable();

    const destination = Array.from(el.querySelectorAll('slv-quote-field select')).find((select) =>
      Array.from((select as HTMLSelectElement).options).some((option) => option.value === 'España'),
    ) as HTMLSelectElement;
    expect(Array.from(destination.options).map((option) => option.value)).toEqual([
      '',
      'Estados Unidos',
      'España',
      'México',
      'Otro país',
    ]);
  });

  it('offers no options for a contract field while the contract is loading', async () => {
    fixture.componentRef.setInput('ramo', 'ramo-viaje');
    fixture.componentRef.setInput('contract', null);
    await fixture.whenStable();

    const selects = Array.from(el.querySelectorAll('slv-quote-field select')) as HTMLSelectElement[];
    expect(selects.every((select) => !Array.from(select.options).some((option) => option.value === 'España'))).toBe(true);
  });

  it('renders the 6 client fields plus the risk fields of the selected ramo', () => {
    expect(el.querySelectorAll('slv-quote-field').length).toBe(6 + 4);
  });

  it('swaps the risk fields when the ramo changes', async () => {
    fixture.componentRef.setInput('ramo', 'ramo-viaje');
    await fixture.whenStable();

    expect(el.querySelectorAll('slv-quote-field').length).toBe(6 + 5);
    expect(el.textContent).toContain('Datos del riesgo · Viaje');
  });

  describe('HU001: Pruebas esperadas del formulario dinámico', () => {
    it('P1: renderiza únicamente los campos correspondientes a los 4 ramos de la HU', async () => {
      // Viaje: 6 cliente + 5 riesgo
      fixture.componentRef.setInput('ramo', 'ramo-viaje');
      await fixture.whenStable();
      expect(el.querySelectorAll('slv-quote-field').length).toBe(6 + 5);

      // Microseguro: 6 cliente + 4 riesgo
      fixture.componentRef.setInput('ramo', 'ramo-microseguro-vida');
      await fixture.whenStable();
      expect(el.querySelectorAll('slv-quote-field').length).toBe(6 + 4);

      // Vida Hipotecario: 6 cliente + 4 riesgo
      fixture.componentRef.setInput('ramo', 'ramo-vida-hipotecario');
      await fixture.whenStable();
      expect(el.querySelectorAll('slv-quote-field').length).toBe(6 + 4);

      // Paramétrico: 6 cliente + 4 riesgo
      fixture.componentRef.setInput('ramo', 'ramo-parametrico');
      await fixture.whenStable();
      expect(el.querySelectorAll('slv-quote-field').length).toBe(6 + 4);
    });

    it('P2: limpia los datos de riesgo al cambiar de ramo sin conservar los del ramo anterior', async () => {
      const comp = fixture.componentInstance;
      // Asignar valor a campo de riesgo de Vida Hipotecario
      (comp as any).setValue('valorCredito', '250000000');
      (comp as any).setValue('nombre', 'Ana Gómez');
      expect((comp as any).valueOf('valorCredito')).toBe('250000000');

      // Cambiar a Viaje
      (comp as any).changeRamo('ramo-viaje');
      await fixture.whenStable();

      // El campo de cliente se preserva, el del riesgo previo se elimina
      expect((comp as any).valueOf('nombre')).toBe('Ana Gómez');
      expect((comp as any).valueOf('valorCredito')).toBe('');
    });

    it('P3: impide avanzar e identifica campos obligatorios vacíos', async () => {
      const comp = fixture.componentInstance;
      let emitted = false;
      comp.quoteReady.subscribe(() => {
        emitted = true;
      });

      const result = comp.submit();
      await fixture.whenStable();

      expect(result).toBe(false);
      expect(emitted).toBe(false);
      expect((comp as any).errors()['numeroDocumento']).toBe('Campo obligatorio');
      expect((comp as any).errors()['nombre']).toBe('Campo obligatorio');
    });

    it('P4: trata campos con únicamente espacios como vacíos', async () => {
      const comp = fixture.componentInstance;
      (comp as any).setValue('nombre', '    ');
      comp.submit();
      await fixture.whenStable();

      expect((comp as any).errors()['nombre']).toBe('Campo obligatorio');
    });

    it('P6 & P7: permite avanzar y emite quoteReady cuando los datos son válidos', async () => {
      const comp = fixture.componentInstance;
      let emittedData: any = null;
      comp.quoteReady.subscribe((data) => {
        emittedData = data;
      });

      // Llenar datos de cliente
      (comp as any).setValue('tipoDocumento', 'CC');
      (comp as any).setValue('numeroDocumento', '1020304050');
      (comp as any).setValue('nombre', 'Juan');
      (comp as any).setValue('apellido', 'Pérez');
      (comp as any).setValue('email', 'juan@email.com');
      (comp as any).setValue('telefono', '3001234567');

      // Llenar datos de riesgo de Vida Hipotecario
      (comp as any).setValue('fechaNacimiento', '1985-05-15');
      (comp as any).setValue('entidad', 'Banco Aurora');
      (comp as any).setValue('valorCredito', '200000000');
      (comp as any).setValue('plazoAnios', '20');

      const result = comp.submit();
      await fixture.whenStable();

      expect(result).toBe(true);
      expect(emittedData).not.toBeNull();
      expect(emittedData.nombre).toBe('Juan');
      expect(emittedData.apellido).toBe('Pérez');
      expect(emittedData.valorCredito).toBe('200000000');
    });

    it('cambia de ramo conservando únicamente datos del cliente y reseteando validación', () => {
      const comp = fixture.componentInstance;
      (comp as any).setValue('numeroDocumento', '1020304050');
      (comp as any).setValue('valorCredito', '200000000');

      (comp as any).changeRamo('ramo-viaje');

      expect((comp as any).ramo()).toBe('ramo-viaje');
      expect((comp as any).valueOf('numeroDocumento')).toBe('1020304050');
      expect((comp as any).valueOf('valorCredito')).toBe('');
    });

    it('retorna valores por defecto seguros en valueOf y errorOf', () => {
      const comp = fixture.componentInstance;
      expect((comp as any).valueOf('inexistente')).toBe('');
      expect((comp as any).errorOf('inexistente')).toBe('');
    });
  });
});
