import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { QuoteFieldDef } from '../../interfaces/quote-field.interface';

/** Campo dinámico del formulario de cotización (texto, correo, fecha o lista). */
@Component({
  selector: 'slv-quote-field',
  imports: [FormsModule, FieldComponent, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-field.component.html',
})
export class QuoteFieldComponent {
  readonly definition = input.required<QuoteFieldDef>();
  readonly value = model('');
  readonly error = input('');

  protected blockNonNumeric(event: KeyboardEvent): void {
    if (!this.definition().numeric) return;
    const allowed =
      /^[0-9]$/.test(event.key) ||
      ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) ||
      event.ctrlKey ||
      event.metaKey;
    if (!allowed) {
      event.preventDefault();
    }
  }
}
