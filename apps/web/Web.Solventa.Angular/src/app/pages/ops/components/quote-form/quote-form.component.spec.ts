import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuoteFormComponent } from './quote-form.component';

describe('QuoteFormComponent', () => {
  let fixture: ComponentFixture<QuoteFormComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [QuoteFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(QuoteFormComponent);
    fixture.componentRef.setInput('ramo', 'VIDA_HIPOTECARIO');
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('lists the six ramos and flags the ones that require consent', () => {
    const options = Array.from(el.querySelectorAll('select')[0].querySelectorAll('option'));

    expect(options.length).toBe(6);
    expect(options.map((option) => option.textContent)).toContain('Vida hipotecario (requiere consentimiento)');
  });

  it('renders the 5 client fields plus the risk fields of the selected ramo', () => {
    expect(el.querySelectorAll('slv-quote-field').length).toBe(5 + 4);
  });

  it('swaps the risk fields when the ramo changes', async () => {
    fixture.componentRef.setInput('ramo', 'VIAJE');
    await fixture.whenStable();

    expect(el.querySelectorAll('slv-quote-field').length).toBe(5 + 5);
    expect(el.textContent).toContain('Datos del riesgo · Viaje');
  });
});
