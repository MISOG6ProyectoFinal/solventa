import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Contenedor de campo: etiqueta en mayúsculas, asterisco requerido, hint y error. */
@Component({
  selector: 'slv-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-1.5' },
  templateUrl: './field.component.html',
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly required = input(false);
  readonly error = input<string>('');
  readonly hint = input<string>('');
}
