import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuoteFieldDef } from '../../interfaces/quote-field.interface';
import { QuoteFieldComponent } from './quote-field.component';

describe('QuoteFieldComponent', () => {
  let fixture: ComponentFixture<QuoteFieldComponent>;

  const render = async (definition: QuoteFieldDef): Promise<HTMLElement> => {
    fixture.componentRef.setInput('definition', definition);
    await fixture.whenStable();
    return fixture.nativeElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [QuoteFieldComponent] }).compileComponents();
    fixture = TestBed.createComponent(QuoteFieldComponent);
  });

  it('renders a text input with its label and placeholder', async () => {
    const el = await render({ key: 'nombre', label: 'Nombre completo', type: 'text', required: true, placeholder: 'Ej. Ana' });

    expect(el.querySelector('label')!.textContent).toContain('Nombre completo');
    expect(el.querySelector('input')!.placeholder).toBe('Ej. Ana');
  });

  it('renders a select with the placeholder plus the declared options', async () => {
    const el = await render({ key: 'tipo', label: 'Tipo', type: 'select', required: false, options: ['CC', 'CE'] });

    expect(el.querySelectorAll('option').length).toBe(3);
  });

  it('writes the typed text into the bound model', async () => {
    const el = await render({ key: 'email', label: 'Correo', type: 'email', required: true });
    const input = el.querySelector('input')!;

    input.value = 'ana@email.com';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('ana@email.com');
  });
});
