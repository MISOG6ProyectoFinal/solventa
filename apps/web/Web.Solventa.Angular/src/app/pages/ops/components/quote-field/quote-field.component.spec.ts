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

  describe('HU001: Validación numérica y bloqueo alfabético (P5)', () => {
    it('bloquea caracteres alfabéticos cuando numeric es true', async () => {
      const el = await render({
        key: 'valorCredito',
        label: 'Valor del crédito',
        type: 'text',
        required: true,
        numeric: true,
      });
      const input = el.querySelector('input')!;

      const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      input.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('permite dígitos cuando numeric es true', async () => {
      const el = await render({
        key: 'valorCredito',
        label: 'Valor del crédito',
        type: 'text',
        required: true,
        numeric: true,
      });
      const input = el.querySelector('input')!;

      const event = new KeyboardEvent('keydown', { key: '5', cancelable: true });
      input.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });

    it('permite teclas de navegación y edición en campos numéricos', async () => {
      const el = await render({
        key: 'valorCredito',
        label: 'Valor del crédito',
        type: 'text',
        required: true,
        numeric: true,
      });
      const input = el.querySelector('input')!;

      for (const key of ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight']) {
        const event = new KeyboardEvent('keydown', { key, cancelable: true });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
    });

    it('muestra el mensaje de error cuando el input error tiene valor', async () => {
      fixture.componentRef.setInput('definition', {
        key: 'nombre',
        label: 'Nombre completo',
        type: 'text',
        required: true,
      });
      fixture.componentRef.setInput('error', 'Campo obligatorio');
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).toContain('Campo obligatorio');
      const hasError =
        fixture.nativeElement.querySelector('input')?.classList.contains('border-error') ||
        fixture.nativeElement.querySelector('.text-error') !== null;
      expect(hasError).toBe(true);
    });
  });
});

