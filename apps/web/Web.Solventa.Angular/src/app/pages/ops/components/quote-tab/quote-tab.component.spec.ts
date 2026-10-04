import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuoteTabComponent } from './quote-tab.component';

describe('QuoteTabComponent', () => {
  let fixture: ComponentFixture<QuoteTabComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [QuoteTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(QuoteTabComponent);
    await fixture.whenStable();
    el = fixture.nativeElement;
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
});
