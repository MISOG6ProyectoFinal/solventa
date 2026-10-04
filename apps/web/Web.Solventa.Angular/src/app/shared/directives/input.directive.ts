import { Directive, computed, input } from '@angular/core';

/**
 * Estilo de campo del DS para `input`, `select` y `textarea`.
 * `<input slvInput [invalid]="!!error" />`
 */
@Directive({
  selector: 'input[slvInput], select[slvInput], textarea[slvInput]',
  host: { '[class]': 'classes()' },
})
export class InputDirective {
  readonly invalid = input(false);

  protected readonly classes = computed(
    () =>
      'w-full bg-white rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors ' +
      (this.invalid() ? 'border-2 border-error' : 'border border-border focus:border-secondary'),
  );
}
