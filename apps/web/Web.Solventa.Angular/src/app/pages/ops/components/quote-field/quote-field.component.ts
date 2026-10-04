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
}
