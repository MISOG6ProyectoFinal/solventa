import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ButtonVariant } from '../../constants/design-tokens.constants';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white',
  secondary: 'bg-secondary text-white',
  accent: 'bg-accent text-white',
  outline: 'bg-white text-foreground border border-border',
  danger: 'bg-error text-white',
  ghost: 'bg-transparent text-secondary hover:bg-muted',
};

/**
 * Botón Solventa. Se usa sobre elementos nativos:
 * `<button slv-button variant="accent">Guardar</button>`
 */
@Component({
  selector: 'button[slv-button], a[slv-button]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');

  protected readonly classes = computed(
    () =>
      `inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity cursor-pointer ` +
      `hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ` +
      VARIANT_CLASSES[this.variant()],
  );
}
